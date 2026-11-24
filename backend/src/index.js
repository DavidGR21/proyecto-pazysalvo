import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { CAUSAS_TERMINACION, requisitosIniciales, SBU_2026 } from "./catalogos.js";
import { calcularLiquidacion, pazSalvoCompleto } from "./liquidacion.js";
import { generarExpedienteCompleto, generarLiquidacionPdf, generarPazYSalvo } from "./pdf.js";
import { seedCasoHipotetico, CASO_ID } from "./seed.js";
import {
  ensureDirs,
  getExpediente,
  listExpedientes,
  removeExpediente,
  upsertExpediente,
  uploadDir,
  UPLOADS_DIR,
} from "./store.js";

ensureDirs();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

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

app.get("/api/catalogos", (_req, res) => {
  res.json({ causas: CAUSAS_TERMINACION, sbu: SBU_2026 });
});

app.get("/api/expedientes", (_req, res) => {
  res.json(listExpedientes().map(attachCalculo));
});

app.post("/api/expedientes", (req, res) => {
  const exp = nuevoExpediente(req.body);
  upsertExpediente(exp);
  res.status(201).json(attachCalculo(exp));
});

app.post("/api/expedientes/caso-hipotetico", async (_req, res) => {
  try {
    const exp = await seedCasoHipotetico();
    res.json(attachCalculo(exp));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/expedientes/:id", (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  res.json(attachCalculo(exp));
});

app.put("/api/expedientes/:id", (req, res) => {
  const actual = getExpediente(req.params.id);
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
  upsertExpediente(merged);
  res.json(attachCalculo(merged));
});

app.delete("/api/expedientes/:id", (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  const dir = uploadDir(exp.id);
  fs.rmSync(dir, { recursive: true, force: true });
  removeExpediente(exp.id);
  res.json({ ok: true });
});

const storage = multer.diskStorage({
  destination: (req, _file, cb) => cb(null, uploadDir(req.params.id)),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
    cb(null, `${uuid()}${ext}`);
  },
});

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
  if (!storedName) return;
  const filePath = path.join(uploadDir(exp.id), storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

app.post("/api/expedientes/:id/evidencias", upload.single("archivo"), (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  if (!req.file) return res.status(400).json({ error: "Adjunte un archivo PDF o imagen" });
  const item = {
    id: path.parse(req.file.filename).name,
    tipo: req.body.tipo || "requisito",
    nombreOriginal: req.file.originalname,
    storedName: req.file.filename,
    mime: req.file.mimetype,
    size: req.file.size,
    observacion: req.body.observacion || "",
    subidoEn: new Date().toISOString(),
  };
  const departamentoId = req.body.departamentoId;
  const requisitoId = req.body.requisitoId;
  if (req.body.alcance === "terminacion") {
    quitarArchivo(exp, exp.terminacion?.evidencia?.storedName);
    exp.terminacion = { ...exp.terminacion, evidencia: item };
  } else {
    const dep = exp.departamentos.find((d) => d.id === departamentoId);
    if (!dep) return res.status(400).json({ error: "Departamento no encontrado" });
    const reqt = dep.requisitos.find((r) => r.id === requisitoId);
    if (!reqt) return res.status(400).json({ error: "Requisito no encontrado" });
    quitarArchivo(exp, reqt.evidencia?.storedName);
    reqt.evidencia = item;
  }
  exp.actualizadoEn = new Date().toISOString();
  upsertExpediente(exp);
  res.status(201).json(attachCalculo(exp));
});

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

app.get("/api/expedientes/:id/evidencias/:evidenciaId", (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  const found = buscarEvidencia(exp, req.params.evidenciaId);
  if (!found) return res.status(404).json({ error: "Evidencia no encontrada" });
  const filePath = path.join(uploadDir(exp.id), found.ev.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });
  res.download(filePath, found.ev.nombreOriginal);
});

app.delete("/api/expedientes/:id/evidencias/:evidenciaId", (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  const found = buscarEvidencia(exp, req.params.evidenciaId);
  if (!found) return res.status(404).json({ error: "Evidencia no encontrada" });
  quitarArchivo(exp, found.ev.storedName);
  found.quitar();
  upsertExpediente(exp);
  res.json(attachCalculo(exp));
});

app.post("/api/expedientes/:id/pdf/paz-salvo", async (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  try {
    const out = await generarPazYSalvo(exp);
    exp.documentos.pazYSalvo = { fileName: out.fileName, generadoEn: new Date().toISOString() };
    upsertExpediente(exp);
    res.json({ ok: true, fileName: out.fileName, url: `/api/expedientes/${exp.id}/pdf/paz-salvo` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/expedientes/:id/pdf/paz-salvo", (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp?.documentos?.pazYSalvo) return res.status(404).json({ error: "Genere primero el PDF" });
  const filePath = path.join(uploadDir(exp.id), exp.documentos.pazYSalvo.fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });
  res.setHeader("Content-Type", "application/pdf");
  res.download(filePath, `PazYSalvo-${exp.codigo}.pdf`);
});

app.post("/api/expedientes/:id/pdf/liquidacion", async (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  try {
    const out = await generarLiquidacionPdf(exp);
    exp.documentos.liquidacion = {
      fileName: out.fileName,
      generadoEn: new Date().toISOString(),
      neto: out.calculo.neto,
    };
    upsertExpediente(exp);
    res.json({ ok: true, fileName: out.fileName, calculo: out.calculo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/expedientes/:id/pdf/expediente", async (req, res) => {
  const exp = getExpediente(req.params.id);
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
    upsertExpediente(exp);
    res.json({ ok: true, fileName: out.fileName, anexos: out.anexos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/expedientes/:id/pdf/expediente", (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp?.documentos?.expediente) return res.status(404).json({ error: "Genere primero el expediente PDF" });
  const filePath = path.join(uploadDir(exp.id), exp.documentos.expediente.fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });
  res.setHeader("Content-Type", "application/pdf");
  res.download(filePath, `Expediente-${exp.codigo}.pdf`);
});

app.get("/api/expedientes/:id/pdf/liquidacion", (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp?.documentos?.liquidacion) return res.status(404).json({ error: "Genere primero el PDF" });
  const filePath = path.join(uploadDir(exp.id), exp.documentos.liquidacion.fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });
  res.setHeader("Content-Type", "application/pdf");
  res.download(filePath, `Liquidacion-${exp.codigo}.pdf`);
});

app.get("/api/expedientes/:id/archivos/:name", (req, res) => {
  const exp = getExpediente(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  const name = path.basename(req.params.name);
  const filePath = path.join(uploadDir(exp.id), name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });
  res.sendFile(filePath);
});

app.listen(PORT, async () => {
  console.log(`API Paz y Salvo en http://localhost:${PORT}`);
  if (!getExpediente(CASO_ID)) {
    const exp = await seedCasoHipotetico();
    console.log("Caso hipotético sembrado:", exp.codigo);
  }
});
