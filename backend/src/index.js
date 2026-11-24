import { app } from "./app.js";
import { CASO_ID, seedCasoHipotetico } from "./seed.js";
import { getExpediente } from "./store.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`API Paz y Salvo en http://localhost:${PORT}`);
  try {
    if (!(await getExpediente(CASO_ID))) {
      const exp = await seedCasoHipotetico();
      console.log("Caso hipotético sembrado:", exp.codigo);
    }
  } catch (err) {
    console.error("No se pudo conectar con Supabase:", err.message);
  }
});
