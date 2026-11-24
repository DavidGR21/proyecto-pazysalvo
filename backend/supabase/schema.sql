-- =====================================================================
-- Paz y Salvo — esquema Supabase
-- Ejecutar en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1) Tabla de expedientes
--    Se guarda el expediente completo en "data" (jsonb), igual que hoy en db.json,
--    más columnas sueltas para buscar/ordenar rápido.
create table if not exists public.expedientes (
  id              text primary key,
  codigo          text,
  cedula          text,
  trabajador      text,
  estado          text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  data            jsonb not null
);

create index if not exists expedientes_actualizado_idx on public.expedientes (actualizado_en desc);
create index if not exists expedientes_cedula_idx      on public.expedientes (cedula);
create index if not exists expedientes_codigo_idx      on public.expedientes (codigo);

-- Rellena las columnas sueltas a partir del JSON en cada insert/update
create or replace function public.expedientes_sync()
returns trigger language plpgsql as $$
begin
  new.codigo         := new.data->>'codigo';
  new.cedula         := new.data->'trabajador'->>'cedula';
  new.trabajador     := new.data->'trabajador'->>'nombres';
  new.estado         := new.data->>'estado';
  new.creado_en      := coalesce((new.data->>'creadoEn')::timestamptz, new.creado_en, now());
  new.actualizado_en := coalesce((new.data->>'actualizadoEn')::timestamptz, now());
  return new;
end $$;

drop trigger if exists trg_expedientes_sync on public.expedientes;
create trigger trg_expedientes_sync
before insert or update on public.expedientes
for each row execute function public.expedientes_sync();

-- 2) Seguridad: RLS activado y SIN políticas públicas.
--    Solo el backend (con la service_role key) puede leer/escribir.
alter table public.expedientes enable row level security;

-- Permisos explícitos para el backend (los proyectos nuevos no los otorgan solos)
grant usage on schema public to service_role;
grant select, insert, update, delete on public.expedientes to service_role;

-- 3) Bucket privado para documentos subidos y PDF generados
--    Estructura de rutas: uploads/<expedienteId>/<archivo>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 12582912,  -- 12 MB
        array['application/pdf','image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

-- Sin políticas en storage.objects para este bucket => solo service_role accede.
-- El frontend descargará los archivos mediante URLs firmadas que genera el backend.
