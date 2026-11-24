import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");
export const UPLOADS_DIR = path.join(ROOT, "uploads");
export const DB_PATH = path.join(DATA_DIR, "db.json");

function emptyDb() {
  return { expedientes: [] };
}

export function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(emptyDb(), null, 2), "utf8");
  }
}

export function readDb() {
  ensureDirs();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return emptyDb();
  }
}

export function writeDb(db) {
  ensureDirs();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function listExpedientes() {
  return readDb().expedientes.sort((a, b) => String(b.actualizadoEn).localeCompare(String(a.actualizadoEn)));
}

export function getExpediente(id) {
  return readDb().expedientes.find((e) => e.id === id) || null;
}

export function upsertExpediente(exp) {
  const db = readDb();
  const i = db.expedientes.findIndex((e) => e.id === exp.id);
  if (i >= 0) db.expedientes[i] = exp;
  else db.expedientes.push(exp);
  writeDb(db);
  return exp;
}

export function removeExpediente(id) {
  const db = readDb();
  db.expedientes = db.expedientes.filter((e) => e.id !== id);
  writeDb(db);
}

export function uploadDir(expedienteId) {
  const dir = path.join(UPLOADS_DIR, expedienteId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
