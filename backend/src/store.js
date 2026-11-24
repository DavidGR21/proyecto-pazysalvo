import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const BUCKET = process.env.SUPABASE_BUCKET || "uploads";
const TABLE = "expedientes";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno (backend/.env)");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function check(error, ctx) {
  if (error) throw new Error(`Supabase (${ctx}): ${error.message}`);
}

// ---------------------------------------------------------------- expedientes

export async function listExpedientes() {
  const { data, error } = await supabase.from(TABLE).select("data").order("actualizado_en", { ascending: false });
  check(error, "listar expedientes");
  return data.map((r) => r.data);
}

export async function getExpediente(id) {
  const { data, error } = await supabase.from(TABLE).select("data").eq("id", id).maybeSingle();
  check(error, "obtener expediente");
  return data?.data || null;
}

export async function upsertExpediente(exp) {
  const { error } = await supabase.from(TABLE).upsert({ id: exp.id, data: exp });
  check(error, "guardar expediente");
  return exp;
}

export async function removeExpediente(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  check(error, "eliminar expediente");
}

// ------------------------------------------------------------------- archivos
// Ruta en el bucket: <expedienteId>/<nombre>

const MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function mimeDe(name) {
  return MIME[path.extname(name).toLowerCase()] || "application/octet-stream";
}

function key(expedienteId, name) {
  return `${expedienteId}/${path.basename(name)}`;
}

export async function putFile(expedienteId, name, buffer, contentType = mimeDe(name)) {
  const { error } = await supabase.storage.from(BUCKET).upload(key(expedienteId, name), buffer, {
    contentType,
    upsert: true,
  });
  check(error, `subir ${name}`);
}

/** Devuelve un Buffer o null si no existe. */
export async function getFile(expedienteId, name) {
  if (!name) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(key(expedienteId, name));
  if (error) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function removeFile(expedienteId, name) {
  if (!name) return;
  await supabase.storage.from(BUCKET).remove([key(expedienteId, name)]);
}

export async function removeDir(expedienteId) {
  const { data } = await supabase.storage.from(BUCKET).list(expedienteId, { limit: 1000 });
  if (data?.length) {
    await supabase.storage.from(BUCKET).remove(data.map((f) => `${expedienteId}/${f.name}`));
  }
}
