import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const files = form.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "Sin archivos" }, { status: 400 });

  const uploaded: { name: string; url: string; path: string }[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "bin";
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("temp-media")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: `Error subiendo ${file.name}: ${error.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("temp-media")
      .getPublicUrl(storagePath);

    uploaded.push({ name: file.name, url: urlData.publicUrl, path: storagePath });
  }

  return NextResponse.json({ files: uploaded });
}
