"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ClienteFormData = {
  nombre: string;
  marca: string;
  que_vende: string;
  cliente_ideal: string;
  nicho: string;
  dolor: string;
  deseo: string;
  tono: string;
  notas: string;
};

function calcCompleteness(data: ClienteFormData): number {
  const fields: (keyof ClienteFormData)[] = [
    "que_vende",
    "cliente_ideal",
    "nicho",
    "dolor",
    "deseo",
    "tono",
  ];
  const filled = fields.filter((f) => data[f]?.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function createCliente(data: ClienteFormData) {
  const { supabase, user } = await getAuthUser();

  const { data: cliente, error } = await supabase
    .from("clients")
    .insert({
      owner_id: user.id,
      nombre: data.nombre.trim(),
      marca: data.marca.trim() || null,
      que_vende: data.que_vende.trim() || null,
      cliente_ideal: data.cliente_ideal.trim() || null,
      nicho: data.nicho.trim() || null,
      dolor: data.dolor.trim() || null,
      deseo: data.deseo.trim() || null,
      tono: data.tono.trim() || null,
      notas: data.notas.trim() || null,
      completeness: calcCompleteness(data),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export async function updateCliente(id: string, data: ClienteFormData) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("clients")
    .update({
      nombre: data.nombre.trim(),
      marca: data.marca.trim() || null,
      que_vende: data.que_vende.trim() || null,
      cliente_ideal: data.cliente_ideal.trim() || null,
      nicho: data.nicho.trim() || null,
      dolor: data.dolor.trim() || null,
      deseo: data.deseo.trim() || null,
      tono: data.tono.trim() || null,
      notas: data.notas.trim() || null,
      completeness: calcCompleteness(data),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

export async function deleteCliente(id: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function addResearch(
  clientId: string,
  fuente: string,
  resumen: string,
) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase.from("client_research").insert({
    client_id: clientId,
    owner_id: user.id,
    fuente: fuente.trim(),
    resumen: resumen.trim(),
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clientId}`);
}

export async function deleteResearch(researchId: string, clientId: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("client_research")
    .delete()
    .eq("id", researchId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clientId}`);
}
