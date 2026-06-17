import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createCarouselItem,
  createCarouselContainer,
  createReelContainer,
  checkContainerStatus,
  publishContainer,
  InstagramApiError,
} from "@/lib/instagram/client";

async function pollUntilFinished(
  containerId: string,
  token: string,
  maxAttempts = 20,
  intervalMs = 5000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const { status_code } = await checkContainerStatus(containerId, token);
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`El video no pudo procesarse (status: ${status_code})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Tiempo de espera agotado procesando el video");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    accountId,
    contentType,
    mediaFiles,
    caption,
    hashtags,
    scriptId,
    tempPaths,
  } = body as {
    accountId: string;
    contentType: "carousel" | "reel";
    mediaFiles: { url: string; type: "image" | "video" | "cover" }[];
    caption: string;
    hashtags: string;
    scriptId?: string;
    tempPaths: string[];
  };

  // Fetch Instagram account
  const { data: account } = await supabase
    .from("instagram_accounts")
    .select("ig_user_id, access_token, username")
    .eq("id", accountId)
    .eq("owner_id", user.id)
    .single();

  if (!account) return NextResponse.json({ error: "Cuenta Instagram no encontrada" }, { status: 404 });

  const fullCaption = hashtags ? `${caption}\n\n${hashtags}` : caption;

  try {
    let publishedId: string;

    if (contentType === "carousel") {
      const imageUrls = mediaFiles
        .filter((f) => f.type === "image")
        .map((f) => f.url);

      if (imageUrls.length < 2) {
        return NextResponse.json({ error: "Un carrusel necesita al menos 2 imágenes" }, { status: 400 });
      }

      // Crear items en secuencia
      const childIds: string[] = [];
      for (const url of imageUrls) {
        const item = await createCarouselItem(account.ig_user_id, account.access_token, url);
        childIds.push(item.id);
      }

      // Dar tiempo a Instagram para procesar las imágenes antes de crear el contenedor
      await new Promise((r) => setTimeout(r, 5000));

      const carouselContainer = await createCarouselContainer(
        account.ig_user_id,
        account.access_token,
        childIds,
        fullCaption,
      );

      // Esperar que el contenedor del carrusel esté listo
      await new Promise((r) => setTimeout(r, 3000));

      const published = await publishContainer(
        account.ig_user_id,
        carouselContainer.id,
        account.access_token,
      );
      publishedId = published.id;

    } else {
      const videoFile = mediaFiles.find((f) => f.type === "video");
      const coverFile = mediaFiles.find((f) => f.type === "cover");

      if (!videoFile) {
        return NextResponse.json({ error: "Se requiere un archivo de video para Reel" }, { status: 400 });
      }

      const reelContainer = await createReelContainer(
        account.ig_user_id,
        account.access_token,
        videoFile.url,
        fullCaption,
        coverFile?.url,
      );

      // Reels necesitan tiempo de procesamiento
      await pollUntilFinished(reelContainer.id, account.access_token);

      const published = await publishContainer(
        account.ig_user_id,
        reelContainer.id,
        account.access_token,
      );
      publishedId = published.id;
    }

    // Actualizar status del guion a publicado
    if (scriptId) {
      await supabase
        .from("scripts")
        .update({ status: "publicado" })
        .eq("id", scriptId)
        .eq("owner_id", user.id);

      await supabase
        .from("content_calendar")
        .update({ status: "publicado" })
        .eq("script_id", scriptId)
        .eq("owner_id", user.id);
    }

    // Limpiar archivos temporales del Storage
    if (tempPaths.length) {
      await supabase.storage.from("temp-media").remove(tempPaths);
    }

    return NextResponse.json({ ok: true, publishedId, username: account.username });

  } catch (err) {
    // Limpiar archivos aunque haya error
    if (tempPaths.length) {
      await supabase.storage.from("temp-media").remove(tempPaths).catch(() => null);
    }

    const message = err instanceof InstagramApiError
      ? err.message
      : err instanceof Error
        ? err.message
        : "Error al publicar";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
