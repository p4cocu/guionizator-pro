#!/usr/bin/env python3
"""
Worker de transcripción de Reels de Instagram para Guionizator Pro.

Flujo:
  1. Toma jobs con status=pending de Supabase (tabla transcription_jobs).
  2. Obtiene el access_token de la cuenta IG desde instagram_accounts.
  3. Re-fetcha un media_url fresco desde la API de Instagram (las URLs CDN expiran ~1h).
  4. Descarga el video con httpx; si falla, busca un archivo local en workers/media/.
  5. Transcribe con faster-whisper (modelo small, español).
  6. Guarda el transcript en instagram_media y marca el job como done.

Requisitos:
  pip install faster-whisper httpx python-dotenv

Variables de entorno (en workers/.env):
  SUPABASE_URL          — URL de tu proyecto Supabase
  SUPABASE_SERVICE_ROLE_KEY — Service role key (bypass RLS, NUNCA en producción)

Uso:
  python workers/ig_transcription_worker.py
  python workers/ig_transcription_worker.py --model medium  # audio difícil
  python workers/ig_transcription_worker.py --once           # procesa y sale
"""

import argparse
import sys
import tempfile
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
IG_GRAPH = "https://graph.instagram.com/v21.0"
POLL_INTERVAL = 10  # segundos entre polls
LOCAL_MEDIA_DIR = Path(__file__).parent / "media"
SUPPORTED_EXTS = [".mp4", ".mov", ".mp3", ".m4a", ".wav"]


def notify_telegram(message: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        httpx.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"},
            timeout=10,
        )
    except Exception as e:
        print(f"  ⚠️  Telegram notify falló: {e}")


def check_env():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("Error: Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en workers/.env")
        sys.exit(1)


def sb_headers() -> dict:
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def sb_get(table: str, query: str = "") -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    r = httpx.get(url, headers=sb_headers(), timeout=15)
    r.raise_for_status()
    return r.json()


def sb_patch(table: str, match: str, data: dict):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{match}"
    r = httpx.patch(url, headers={**sb_headers(), "Prefer": "return=minimal"}, json=data, timeout=15)
    r.raise_for_status()


def sb_upsert(table: str, data: dict):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.post(
        url,
        headers={**sb_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=data,
        timeout=15,
    )
    r.raise_for_status()


def fetch_fresh_media_url(ig_media_id: str, access_token: str) -> str | None:
    """Re-fetcha la media_url directamente desde la API de Instagram."""
    try:
        r = httpx.get(
            f"{IG_GRAPH}/{ig_media_id}",
            params={"fields": "media_url,media_type", "access_token": access_token},
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("media_url")
    except Exception as e:
        print(f"  ⚠️  No se pudo obtener media_url de IG API: {e}")
    return None


def download_video(media_url: str, dest: Path) -> bool:
    """Descarga el video CDN de Instagram a dest. Devuelve True si tuvo éxito."""
    try:
        with httpx.stream(
            "GET",
            media_url,
            follow_redirects=True,
            timeout=120,
            headers={"User-Agent": "Mozilla/5.0"},
        ) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_bytes(chunk_size=65536):
                    f.write(chunk)
        size_mb = dest.stat().st_size / 1_048_576
        print(f"  Descargado: {size_mb:.1f} MB")
        return True
    except Exception as e:
        print(f"  ⚠️  Descarga falló: {e}")
        return False


def find_local_file(ig_media_id: str) -> Path | None:
    """Busca un archivo local en workers/media/{ig_media_id}.*"""
    for ext in SUPPORTED_EXTS:
        candidate = LOCAL_MEDIA_DIR / f"{ig_media_id}{ext}"
        if candidate.exists():
            return candidate
    return None


def transcribe(audio_path: str, model) -> str:
    segments_gen, _ = model.transcribe(audio_path, language="es", beam_size=5)
    return " ".join(seg.text.strip() for seg in segments_gen)


def process_job(job: dict, model) -> None:
    job_id: str = job["id"]
    ig_media_id: str = job["ig_media_id"]
    account_id: str = job["account_id"]
    owner_id: str = job["owner_id"]

    print(f"\n[{ig_media_id[:20]}…] Procesando job {job_id[:8]}…")

    # Marcar como processing
    sb_patch("transcription_jobs", f"id=eq.{job_id}", {
        "status": "processing",
        "updated_at": "now()",
    })

    try:
        # Obtener access_token de la cuenta
        accounts = sb_get("instagram_accounts", f"id=eq.{account_id}&select=access_token")
        if not accounts:
            raise ValueError("Cuenta de Instagram no encontrada en Supabase")
        access_token: str = accounts[0]["access_token"]

        # Re-fetchar media_url fresco (las URLs CDN de Meta expiran ~1h)
        print("  Obteniendo media_url fresca de Instagram…")
        media_url = fetch_fresh_media_url(ig_media_id, access_token)

        audio_path: str | None = None

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_video = Path(tmpdir) / "video.mp4"

            if media_url:
                print("  Descargando video…")
                if download_video(media_url, tmp_video):
                    audio_path = str(tmp_video)

            # Fallback: archivo local en workers/media/
            if not audio_path:
                local = find_local_file(ig_media_id)
                if local:
                    print(f"  Usando archivo local: {local.name}")
                    audio_path = str(local)

            if not audio_path:
                raise ValueError(
                    "No se pudo obtener el audio. "
                    "La descarga de IG falló y no hay archivo local en workers/media/. "
                    f"Tip: ponés el archivo como workers/media/{ig_media_id}.mp4"
                )

            print("  Transcribiendo…")
            transcript = transcribe(audio_path, model)

        # Guardar transcript en instagram_media (upsert por account_id + ig_media_id)
        sb_upsert("instagram_media", {
            "owner_id": owner_id,
            "account_id": account_id,
            "ig_media_id": ig_media_id,
            "media_type": "VIDEO",
            "transcript": transcript,
            "transcribed_at": "now()",
            "updated_at": "now()",
        })

        # Marcar job como done
        sb_patch("transcription_jobs", f"id=eq.{job_id}", {
            "status": "done",
            "error": None,
            "updated_at": "now()",
        })

        print(f"  ✅ Listo — {len(transcript)} caracteres transcritos.")
        notify_telegram(
            f"✅ <b>Transcripción lista</b>\n"
            f"Media: <code>{ig_media_id}</code>\n"
            f"{len(transcript)} caracteres"
        )

    except Exception as e:
        print(f"  ❌ Error: {e}")
        sb_patch("transcription_jobs", f"id=eq.{job_id}", {
            "status": "error",
            "error": str(e)[:500],
            "updated_at": "now()",
        })
        notify_telegram(
            f"❌ <b>Job fallido</b>\n"
            f"Media: <code>{ig_media_id}</code>\n"
            f"Error: {str(e)[:300]}\n\n"
            f"💡 Si la descarga de IG falló, podés colocar el archivo manualmente en "
            f"<code>workers/media/{ig_media_id}.mp4</code>"
        )


def main():
    parser = argparse.ArgumentParser(description="Worker de transcripción de Instagram Reels")
    parser.add_argument(
        "--model",
        default="small",
        choices=["tiny", "base", "small", "medium", "large-v2", "large-v3"],
        help="Modelo faster-whisper (default: small)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Procesar un solo job y salir (en lugar de hacer loop continuo)",
    )
    args = parser.parse_args()

    check_env()
    LOCAL_MEDIA_DIR.mkdir(exist_ok=True)

    print("🎙  Worker de transcripción — Guionizator Pro")
    print(f"   Modelo: {args.model} | Supabase: {SUPABASE_URL[:40]}…")
    print(f"   Modo: {'una pasada' if args.once else f'loop cada {POLL_INTERVAL}s'}")
    print("   Ctrl+C para detener\n")

    # Cargar modelo una sola vez (evita re-cargar en cada job)
    print(f"Cargando modelo faster-whisper '{args.model}'…")
    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    print("Modelo listo. Esperando jobs…\n")

    dots = 0
    while True:
        try:
            jobs = sb_get(
                "transcription_jobs",
                "status=eq.pending&order=created_at.asc&limit=1"
                "&select=id,owner_id,account_id,ig_media_id",
            )
            if jobs:
                dots = 0
                process_job(jobs[0], model)
                if args.once:
                    break
            else:
                print(".", end="", flush=True)
                dots += 1
                if dots >= 60:
                    print()
                    dots = 0
                if args.once:
                    print("\nNo hay jobs pendientes.")
                    break

        except KeyboardInterrupt:
            print("\n\nDetenido.")
            break
        except Exception as e:
            print(f"\n[Error en loop] {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
