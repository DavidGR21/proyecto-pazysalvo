import path from "node:path";
import cors from "cors";
import express from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { CAUSAS_TERMINACION, requisitosIniciales, SBU_2026 } from "./catalogos.js";
import { calcularLiquidacion, pazSalvoCompleto } from "./liquidacion.js";
import { generarExpedienteCompleto, generarLiquidacionPdf, generarPazYSalvo } from "./pdf.js";
import { seedCasoHipotetico } from "./seed.js";
import {
  getExpediente,
  getFile,
  listExpedientes,
  mimeDe,
  putFile,
  removeDir,
  removeExpediente,
  removeFile,
  upsertExpediente,
} from "./store.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "8mb" }));

// Envuelve handlers async para que los errores lleguen al manejador de errores
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function enviarArchivo(res, expId, name, descarga, inline = false) {
  const data = await getFile(expId, name);
  if (!data) return res.status(404).json({ error: "Archivo no encontrado" });
  res.setHeader("Content-Type", mimeDe(name));
  const disp = inline ? "inline" : "attachment";
  res.setHeader("Content-Disposition", `${disp}; filename*=UTF-8''${encodeURIComponent(descarga || name)}`);
  res.send(data);
}

function nuevoExpediente(body = {}) {
  const now = new Date().toISOString();
  const id = uuid();
  return {
    id,
    codigo: body.codigo || `EXP-${String(Date.now()).slice(-6)}`,
    hipotetico: false,
    creadoEn: now,
    actualizadoEn: now,
    empleador: body.empleador || {
      razonSocial: "",
      ruc: "",
      ciudad: "",
      direccion: "",
      telefono: "",
      correo: "",
      representante: "",
      cargoRepresentante: "Representante legal",
      actividad: "",
    },
    trabajador: body.trabajador || {
      nombres: "",
      cedula: "",
      cargo: "",
      unidad: "",
      jefeInmediato: "",
      tipoVinculacion: "Contrato indefinido — Código del Trabajo",
      fechaIngreso: "",
      fechaSalida: "",
      sueldo: 0,
      correo: "",
      telefono: "",
      domicilio: "",
    },
    terminacion: body.terminacion || { causaId: "", fechaAviso: "", observaciones: "" },
    liquidacion: {
      sbu: SBU_2026,
      vacacionesPendientes: 0,
      diasTrabajadosMesSalida: 0,
      incluirFondosReserva: false,
      anticipos: 0,
      otrosIngresos: 0,
      otrasDeducciones: 0,
      aporteIessPct: 9.45,
      elaboradoPor: "",
      revisadoPor: "",
      fechaEmision: "",
      ...(body.liquidacion || {}),
    },
    pazSalvo: body.pazSalvo || { fechaEmision: "" },
    departamentos: body.departamentos || requisitosIniciales(),
    evidencias: [],
    documentos: { pazYSalvo: null, liquidacion: null, expediente: null },
  };
}

function attachCalculo(exp) {
  const calculo = calcularLiquidacion(exp);
  return {
    ...exp,
    liquidacion: { ...exp.liquidacion, calculo },
    pazSalvoCompleto: pazSalvoCompleto(exp.departamentos),
  };
}

app.get("/api/catalogos", h(async (_req, res) => {
  res.json({ causas: CAUSAS_TERMINACION, sbu: SBU_2026 });
}));

app.get("/api/expedientes", h(async (_req, res) => {
  res.json((await listExpedientes()).map(attachCalculo));
}));

app.post("/api/expedientes", h(async (req, res) => {
  const exp = nuevoExpediente(req.body);
  await upsertExpediente(exp);
  res.status(201).json(attachCalculo(exp));
}));

app.post("/api/expedientes/caso-hipotetico", h(async (_req, res) => {
  try {
    const exp = await seedCasoHipotetico();
    res.json(attachCalculo(exp));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}));

app.get("/api/expedientes/:id", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  res.json(attachCalculo(exp));
}));

app.put("/api/expedientes/:id", h(async (req, res) => {
  const actual = await getExpediente(req.params.id);
  if (!actual) return res.status(404).json({ error: "Expediente no encontrado" });
  const merged = {
    ...actual,
    ...req.body,
    id: actual.id,
    evidencias: actual.evidencias,
    documentos: actual.documentos,
    actualizadoEn: new Date().toISOString(),
    empleador: { ...actual.empleador, ...(req.body.empleador || {}) },
    trabajador: { ...actual.trabajador, ...(req.body.trabajador || {}) },
    terminacion: {
      ...actual.terminacion,
      ...(req.body.terminacion || {}),
      evidencia: req.body.terminacion?.evidencia ?? actual.terminacion?.evidencia ?? null,
    },
    liquidacion: { ...actual.liquidacion, ...(req.body.liquidacion || {}) },
    pazSalvo: { ...actual.pazSalvo, ...(req.body.pazSalvo || {}) },
    departamentos: fusionarDepartamentos(actual.departamentos, req.body.departamentos),
  };
  await upsertExpediente(merged);
  res.json(attachCalculo(merged));
}));

app.delete("/api/expedientes/:id", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  await removeDir(exp.id);
  await removeExpediente(exp.id);
  res.json({ ok: true });
}));

// Los archivos se reciben en memoria y luego se suben a Supabase Storage.
// Vercel limita el cuerpo de la petición a ~4.5 MB.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /pdf|jpeg|jpg|png|webp|gif/i.test(file.mimetype) || /\.(pdf|jpe?g|png|webp|gif)$/i.test(file.originalname);
    cb(ok ? null : new Error("Solo se permiten PDF o imágenes"), ok);
  },
});

function fusionarDepartamentos(actuales = [], incoming) {
  if (!incoming) return actuales;
  return incoming.map((dep) => {
    const prev = actuales.find((d) => d.id === dep.id);
    return {
      ...dep,
      requisitos: (dep.requisitos || []).map((r) => {
        const prevR = prev?.requisitos?.find((x) => x.id === r.id);
        return { ...r, evidencia: r.evidencia ?? prevR?.evidencia ?? null };
      }),
    };
  });
}

function quitarArchivo(exp, storedName) {
  return removeFile(exp.id, storedName);
}

app.post("/api/expedientes/:id/evidencias", upload.single("archivo"), h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  if (!req.file) return res.status(400).json({ error: "Adjunte un archivo PDF o imagen" });
  const ext = path.extname(req.file.originalname || "").toLowerCase() || ".bin";
  const evId = uuid();
  const storedName = `${evId}${ext}`;
  await putFile(exp.id, storedName, req.file.buffer, req.file.mimetype);
  const item = {
    id: evId,
    tipo: req.body.tipo || "requisito",
    nombreOriginal: req.file.originalname,
    storedName,
    mime: req.file.mimetype,
    size: req.file.size,
    observacion: req.body.observacion || "",
    subidoEn: new Date().toISOString(),
  };
  const departamentoId = req.body.departamentoId;
  const requisitoId = req.body.requisitoId;
  if (req.body.alcance === "terminacion") {
    await quitarArchivo(exp, exp.terminacion?.evidencia?.storedName);
    exp.terminacion = { ...exp.terminacion, evidencia: item };
  } else {
    const dep = exp.departamentos.find((d) => d.id === departamentoId);
    if (!dep) return res.status(400).json({ error: "Departamento no encontrado" });
    const reqt = dep.requisitos.find((r) => r.id === requisitoId);
    if (!reqt) return res.status(400).json({ error: "Requisito no encontrado" });
    await quitarArchivo(exp, reqt.evidencia?.storedName);
    reqt.evidencia = item;
  }
  exp.actualizadoEn = new Date().toISOString();
  await upsertExpediente(exp);
  res.status(201).json(attachCalculo(exp));
}));

function buscarEvidencia(exp, evidenciaId) {
  if (exp.terminacion?.evidencia?.id === evidenciaId) {
    return { ev: exp.terminacion.evidencia, quitar: () => { exp.terminacion.evidencia = null; } };
  }
  for (const dep of exp.departamentos || []) {
    for (const r of dep.requisitos || []) {
      if (r.evidencia?.id === evidenciaId) {
        return { ev: r.evidencia, quitar: () => { r.evidencia = null; } };
      }
    }
  }
  return null;
}

app.get("/api/expedientes/:id/evidencias/:evidenciaId", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  const found = buscarEvidencia(exp, req.params.evidenciaId);
  if (!found) return res.status(404).json({ error: "Evidencia no encontrada" });
  await enviarArchivo(res, exp.id, found.ev.storedName, found.ev.nombreOriginal);
}));

app.delete("/api/expedientes/:id/evidencias/:evidenciaId", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  const found = buscarEvidencia(exp, req.params.evidenciaId);
  if (!found) return res.status(404).json({ error: "Evidencia no encontrada" });
  await quitarArchivo(exp, found.ev.storedName);
  found.quitar();
  await upsertExpediente(exp);
  res.json(attachCalculo(exp));
}));

app.post("/api/expedientes/:id/pdf/paz-salvo", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  try {
    const out = await generarPazYSalvo(exp);
    exp.documentos.pazYSalvo = { fileName: out.fileName, generadoEn: new Date().toISOString() };
    await upsertExpediente(exp);
    res.json({ ok: true, fileName: out.fileName, url: `/api/expedientes/${exp.id}/pdf/paz-salvo` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}));

app.get("/api/expedientes/:id/pdf/paz-salvo", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp?.documentos?.pazYSalvo) return res.status(404).json({ error: "Genere primero el PDF" });
  await enviarArchivo(res, exp.id, exp.documentos.pazYSalvo.fileName, `PazYSalvo-${exp.codigo}.pdf`);
}));

app.post("/api/expedientes/:id/pdf/liquidacion", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  try {
    const out = await generarLiquidacionPdf(exp);
    exp.documentos.liquidacion = {
      fileName: out.fileName,
      generadoEn: new Date().toISOString(),
      neto: out.calculo.neto,
    };
    await upsertExpediente(exp);
    res.json({ ok: true, fileName: out.fileName, calculo: out.calculo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}));

app.post("/api/expedientes/:id/pdf/expediente", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  try {
    const out = await generarExpedienteCompleto(exp);
    exp.documentos.pazYSalvo = { fileName: out.paz.fileName, generadoEn: new Date().toISOString() };
    exp.documentos.liquidacion = {
      fileName: out.liq.fileName,
      generadoEn: new Date().toISOString(),
      neto: out.liq.calculo.neto,
    };
    exp.documentos.expediente = { fileName: out.fileName, generadoEn: new Date().toISOString(), anexos: out.anexos };
    await upsertExpediente(exp);
    res.json({ ok: true, fileName: out.fileName, anexos: out.anexos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}));

app.get("/api/expedientes/:id/pdf/expediente", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp?.documentos?.expediente) return res.status(404).json({ error: "Genere primero el expediente PDF" });
  await enviarArchivo(res, exp.id, exp.documentos.expediente.fileName, `Expediente-${exp.codigo}.pdf`);
}));

app.get("/api/expedientes/:id/pdf/liquidacion", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp?.documentos?.liquidacion) return res.status(404).json({ error: "Genere primero el PDF" });
  await enviarArchivo(res, exp.id, exp.documentos.liquidacion.fileName, `Liquidacion-${exp.codigo}.pdf`);
}));

app.get("/api/expedientes/:id/archivos/:name", h(async (req, res) => {
  const exp = await getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  await enviarArchivo(res, exp.id, path.basename(req.params.name), undefined, true);
}));

// Manejador de errores (incluye errores de multer y de Supabase)
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 500;
  res.status(status).json({ error: err.message || "Error interno" });
});

export default app;
