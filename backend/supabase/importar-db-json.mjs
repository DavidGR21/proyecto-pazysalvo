// Sube los expedientes de data/db.json y los archivos de uploads/ a Supabase.
// Uso (desde la carpeta backend):
//   npm install @supabase/supabase-js
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/importar-db-json.mjs
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const db = JSON.parse(fs.readFileSync("data/db.json", "utf8"));
for (const exp of db.expedientes) {
  const { error } = await sb.from("expedientes").upsert({ id: exp.id, data: exp });
  console.log(error ? `✗ ${exp.id}: ${error.message}` : `✓ expediente ${exp.id}`);
}

const MIME = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
if (fs.existsSync("uploads")) {
  for (const dir of fs.readdirSync("uploads")) {
    const full = path.join("uploads", dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      const { error } = await sb.storage.from("uploads").upload(`${dir}/${f}`, fs.readFileSync(path.join(full, f)), {
        upsert: true,
        contentType: MIME[path.extname(f).toLowerCase()] || "application/octet-stream",
      });
      console.log(error ? `✗ ${dir}/${f}: ${error.message}` : `✓ archivo ${dir}/${f}`);
    }
  }
}
