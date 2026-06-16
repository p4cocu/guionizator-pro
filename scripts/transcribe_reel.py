#!/usr/bin/env python3
"""
Descarga y transcribe un Reel de competencia con faster-whisper (local, sin API externa).
El resultado se imprime en stdout para que la API route de Next.js lo capture.

Uso directo:
    python3 scripts/transcribe_reel.py <url_o_permalink>

Requiere:
    pip3 install faster-whisper yt-dlp
"""

import sys
import json
import tempfile
import time
from pathlib import Path


SUPPORTED_FORMATS = {".ogg", ".mp3", ".wav", ".m4a", ".mp4", ".mov", ".mkv", ".flac", ".aac"}
DEFAULT_MODEL = "small"


def download_audio(url: str, tmpdir: str) -> str:
    import yt_dlp

    out_path = str(Path(tmpdir) / "audio.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_path,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.extract_info(url, download=True)

    audio_path = Path(tmpdir) / "audio.mp3"
    if not audio_path.exists():
        raise FileNotFoundError("yt-dlp no pudo descargar el audio.")
    return str(audio_path)


def transcribe_file(audio_path: str, model_name: str = DEFAULT_MODEL) -> str:
    from faster_whisper import WhisperModel

    print(f"[transcribe] Cargando modelo '{model_name}'...", file=sys.stderr)
    model = WhisperModel(model_name, device="auto", compute_type="int8")

    print("[transcribe] Transcribiendo...", file=sys.stderr)
    t0 = time.time()
    segments_gen, info = model.transcribe(audio_path, beam_size=5)
    segments = list(segments_gen)
    elapsed = time.time() - t0

    text = " ".join(seg.text.strip() for seg in segments)
    lang = info.language if info else "?"
    print(f"[transcribe] Listo en {elapsed:.1f}s — idioma detectado: {lang}", file=sys.stderr)
    return text


def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: python3 transcribe_reel.py <url_o_archivo>", file=sys.stderr)
        sys.exit(1)

    source = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_MODEL
    is_url = source.startswith("http://") or source.startswith("https://")

    if is_url:
        print(f"[transcribe] Descargando: {source}", file=sys.stderr)
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = download_audio(source, tmpdir)
            text = transcribe_file(audio_path, model)
    else:
        audio_path = Path(source)
        if not audio_path.exists():
            print(f"[transcribe] Error: '{source}' no existe.", file=sys.stderr)
            sys.exit(1)
        text = transcribe_file(str(audio_path), model)

    # Salida: JSON con la transcripción (para que la API route lo parsee fácilmente)
    print(json.dumps({"transcription": text}, ensure_ascii=False))


if __name__ == "__main__":
    main()
