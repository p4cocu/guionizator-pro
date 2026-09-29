-- ============================================================================
-- 0016 — Ficha de oferta por producto/servicio + guion ligado a un servicio
-- ============================================================================
--
-- QUÉ RESUELVE
--   `client_products` solo guardaba nombre, descripción y tipo, y la IA de
--   guiones ni siquiera lo leía (solo el generador de calendario). Para hacer
--   contenido que PROMUEVA un servicio hace falta lo que un buen vendedor sabe
--   de memoria: para quién es, qué resuelve, cómo se empieza, qué objeciones
--   aparecen, qué oferta hay. Sin eso el modelo lo inventa.
--
-- QUÉ CAMBIA
--   1. Diez columnas de texto en `client_products` (la "ficha de oferta"),
--      agrupadas en la UI en tres bloques. Todas nullable, sin CHECK: son
--      texto libre que escribe el dueño.
--        Base:       para_quien, problema, beneficios, proceso
--        Persuasión: diferenciador, objeciones, prueba_social
--        Oferta:     oferta, garantia, cta
--      + `updated_at` para saber cuándo se tocó la ficha por última vez.
--      `descripcion` sigue existiendo: es el "qué es" en una línea.
--
--   2. `scripts.product_id` → `client_products(id)`, ON DELETE SET NULL.
--      El servicio para el que se escribió el guion (desde "Nuevo guion" o
--      desde "Adaptar" en Competencia). Con eso el Copy Expert y las portadas
--      leen la misma ficha, y en `/guiones/[id]` se ve el badge del servicio.
--      SET NULL y no CASCADE a propósito: si un servicio deja de darse se borra
--      desde el perfil del cliente, pero los guiones que se hicieron para él
--      son trabajo hecho y se quedan (solo pierden la etiqueta).
--
--   3. `scripts_guard_member_update` congela también `product_id` cuando quien
--      edita no es el dueño, por el mismo motivo que ya congelaba `client_id`
--      y `generated_by`: la RLS es por fila, no por columna, y un
--      `collaborator` puede hacer UPDATE de este guion desde PostgREST.
--
-- LECTURA DESDE EL PORTAL
--   `client_products` ya tiene `client_products_member_select`
--   (has_client_access), así que un miembro de la marca puede leer las columnas
--   nuevas de SUS productos. Es aceptable: es la ficha de su propia oferta. La
--   pantalla de investigación del portal selecciona columnas explícitas y no
--   muestra ninguna de estas.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/products/fields.ts                         (fuente de verdad de los campos)
--   - lib/products/load.ts                           (lee la ficha para los prompts)
--   - app/(app)/clientes/productActions.ts           (editar / llenar desde landing)
--   - app/(app)/clientes/[id]/ProductsSection.tsx    (la ficha editable)
--   - app/(app)/guiones/nuevo/*                      (selector, ideas, preguntas)
--   - app/(app)/guiones/actions.ts                   (guarda y arrastra product_id)
--   - app/(app)/competencia/AdaptarModal.tsx         (adaptar a un servicio)
--   - app/api/ai/{big-idea,structures,script,adapt-competitor,copy,cover}
--
-- Aditiva e idempotente. Se aplica ANTES del deploy: la app publicada hoy no
-- selecciona ninguna columna nueva y sigue andando. Al revés no: el perfil del
-- cliente y "Nuevo guion" piden las columnas nuevas al cargar.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Ficha de oferta
-- ────────────────────────────────────────────────────────────────────────────
alter table client_products
  add column if not exists para_quien    text,
  add column if not exists problema      text,
  add column if not exists beneficios    text,
  add column if not exists proceso       text,
  add column if not exists diferenciador text,
  add column if not exists objeciones    text,
  add column if not exists prueba_social text,
  add column if not exists oferta        text,
  add column if not exists garantia      text,
  add column if not exists cta           text,
  add column if not exists updated_at    timestamptz default now();

comment on column client_products.para_quien is 'Ficha de oferta (0016): a quién va dirigido.';
comment on column client_products.problema is 'Ficha de oferta (0016): qué problema resuelve.';
comment on column client_products.beneficios is 'Ficha de oferta (0016): beneficios / resultado que obtiene quien lo compra.';
comment on column client_products.proceso is 'Ficha de oferta (0016): cómo se inicia y cómo es el proceso.';
comment on column client_products.diferenciador is 'Ficha de oferta (0016): qué lo hace distinto a las alternativas.';
comment on column client_products.objeciones is 'Ficha de oferta (0016): objeciones frecuentes y cómo se responden.';
comment on column client_products.prueba_social is 'Ficha de oferta (0016): resultados reales, casos, testimonios. La IA NO inventa nada que no esté acá.';
comment on column client_products.oferta is 'Ficha de oferta (0016): precio u oferta vigente.';
comment on column client_products.garantia is 'Ficha de oferta (0016): garantía.';
comment on column client_products.cta is 'Ficha de oferta (0016): CTA principal (a dónde mandar a la gente).';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Guion ligado a un servicio
-- ────────────────────────────────────────────────────────────────────────────
alter table scripts
  add column if not exists product_id uuid
    references client_products(id) on delete set null;

create index if not exists scripts_product_id_idx on scripts(product_id);

comment on column scripts.product_id is
  'Servicio/producto para el que se escribió el guion (0016). NULL = sin servicio. ON DELETE SET NULL: borrar el servicio no borra los guiones.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. El trigger congela product_id para quien no es dueño
-- ────────────────────────────────────────────────────────────────────────────
-- Misma función de 0009 + una línea. El trigger `scripts_guard_update` ya
-- apunta a esta función, así que no hace falta recrearlo.
create or replace function public.scripts_guard_member_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Sin sesión de usuario (service role: crons, background functions): no se
  -- toca nada, para no pisar last_edited_by con null.
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() is distinct from old.owner_id then
    new.owner_id     := old.owner_id;
    new.client_id    := old.client_id;
    new.generated_by := old.generated_by;
    new.product_id   := old.product_id;
  end if;

  new.last_edited_by := auth.uid();
  new.last_edited_at := now();
  return new;
end;
$function$;


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- select column_name from information_schema.columns
-- where table_name = 'client_products' order by ordinal_position;
--
-- select column_name, data_type from information_schema.columns
-- where table_name = 'scripts' and column_name = 'product_id';
--
-- select pg_get_functiondef('public.scripts_guard_member_update'::regproc);
-- ============================================================================
