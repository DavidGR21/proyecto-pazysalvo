import fs from "node:fs";
import path from "node:path";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import PDFKit from "pdfkit";
import { calcularLiquidacion, fechaLarga, fmtMoney, pazSalvoCompleto } from "./liquidacion.js";
import { uploadDir } from "./store.js";

const NAVY = "#0f2744";
const GOLD = "#b8860b";
const LINE = "#c5b48a";
const MUTED = "#4b5563";

function headerBox(doc, title, subtitle) {
  doc.save();
  doc.rect(40, 36, 515, 72).fill(NAVY);
  doc.fillColor("#f8f1d8").font("Helvetica-Bold").fontSize(13).text(title, 52, 50, { width: 490, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#e8d9a8").text(subtitle, 52, 72, { width: 490, align: "center" });
  doc.restore();
  doc.moveTo(40, 108).lineTo(555, 108).strokeColor(GOLD).lineWidth(2).stroke();
}

function kv(doc, label, value, x, y, w = 250) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(NAVY).text(label, x, y, { width: w });
  doc.font("Helvetica").fontSize(9).fillColor("#111").text(value || "—", x, y + 11, { width: w });
}

function firma(doc, x, y, w, nombre, cargo) {
  doc.moveTo(x + 16, y).lineTo(x + w - 16, y).strokeColor("#333").lineWidth(0.7).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111").text(nombre || " ", x, y + 6, { width: w, align: "center" });
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(cargo || " ", x, y + 18, { width: w, align: "center" });
}

function check(doc, x, y, estado) {
  const size = 9;
  doc.rect(x, y, size, size).strokeColor(NAVY).lineWidth(0.8).stroke();
  if (estado === "si" || estado === "aprobado") {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0a7a3e").text("X", x + 1.5, y - 1);
  } else if (estado === "no") {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#b42318").text("—", x + 1.2, y);
  } else if (estado === "na" || estado === "no_aplica") {
    doc.font("Helvetica").fontSize(6.5).fillColor(MUTED).text("N/A", x + 11, y + 0.5);
  }
}

export function generarPazYSalvo(exp) {
  const calc = calcularLiquidacion(exp);
  const dir = uploadDir(exp.id);
  const fileName = `paz-y-salvo-${exp.codigo}.pdf`;
  const filePath = path.join(dir, fileName);
  const doc = new PDFKit({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  headerBox(
    doc,
    "CERTIFICADO DE PAZ Y SALVO PARA EL PAGO DE LIQUIDACIONES",
    `${exp.empleador.razonSocial}  ·  RUC ${exp.empleador.ruc}`
  );

  doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text("DATOS PERSONALES", 40, 118);
  doc.rect(40, 132, 515, 96).strokeColor(LINE).stroke();

  const t = exp.trabajador;
  kv(doc, "Servidor / trabajador", t.nombres, 50, 140, 240);
  kv(doc, "Cédula", t.cedula, 310, 140, 110);
  kv(doc, "Cargo", t.cargo, 430, 140, 115);
  kv(doc, "Unidad", t.unidad, 50, 172, 240);
  kv(doc, "Jefe inmediato", t.jefeInmediato, 310, 172, 230);
  kv(doc, "Tipo de vinculación", t.tipoVinculacion, 50, 204, 240);
  kv(doc, "Causa de terminación", calc.causa?.nombre, 310, 204, 230);

  doc.font("Helvetica").fontSize(8.5).fillColor("#222").text(
    `Yo, ${t.nombres}, con cédula ${t.cedula}, declaro que he cumplido los requisitos para la liquidación de mis haberes y he procedido a la entrega de los documentos y bienes que me fueron confiados para el cumplimiento de mis funciones, lo cual es certificado por los responsables de las unidades correspondientes.`,
    40,
    238,
    { width: 515, align: "justify", lineGap: 2 }
  );

  let y = 292;
  for (const dep of exp.departamentos || []) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    doc.rect(40, y, 515, 18).fill(NAVY);
    doc.fillColor("#f8f1d8").font("Helvetica-Bold").fontSize(8).text(dep.nombre.toUpperCase(), 48, y + 5, { width: 360 });
    const estadoTxt = { aprobado: "APROBADO", pendiente: "PENDIENTE", observado: "OBSERVADO", no_aplica: "NO APLICA" }[dep.estado] || dep.estado;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#f8f1d8").text(estadoTxt, 400, y + 5, { width: 145, align: "right" });
    y += 22;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text("Requisito", 50, y);
    doc.text("SI", 430, y);
    doc.text("NO", 458, y);
    doc.text("N/A", 488, y);
    y += 12;
    for (const r of dep.requisitos) {
      doc.font("Helvetica").fontSize(8).fillColor("#111").text(r.etiqueta, 50, y, { width: 370 });
      check(doc, 430, y, r.valor === "si" ? "si" : r.valor === "no" ? "no" : r.valor === "na" ? "na" : "");
      if (r.valor === "no") check(doc, 458, y, "no");
      else doc.rect(458, y, 9, 9).strokeColor(NAVY).lineWidth(0.8).stroke();
      if (r.valor === "na") doc.font("Helvetica").fontSize(6.5).fillColor(MUTED).text("N/A", 488, y);
      else doc.rect(488, y, 9, 9).strokeColor(NAVY).lineWidth(0.8).stroke();
      y += 14;
    }
    doc.font("Helvetica").fontSize(8).fillColor("#111").text(`Responsable: ${dep.responsable || "________________"}  ·  ${dep.cargoResponsable || ""}`, 50, y, { width: 300 });
    doc.text(`Fecha: ${dep.fecha ? fechaLarga(dep.fecha) : "________________"}`, 360, y, { width: 180, align: "right" });
    y += 14;
    if (dep.observaciones) {
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED).text(`Obs.: ${dep.observaciones}`, 50, y, { width: 490 });
      y += 16;
    }
    y += 10;
  }

  if (y > 680) {
    doc.addPage();
    y = 60;
  }
  const completo = pazSalvoCompleto(exp.departamentos);
  doc.rect(40, y, 515, 36).strokeColor(completo ? "#0a7a3e" : GOLD).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(completo ? "#0a7a3e" : "#92400e").text(
    completo
      ? "CERTIFICACIÓN: El trabajador se encuentra PAZ Y SALVO con las unidades de la empresa y puede procederse al pago de la liquidación."
      : "ESTADO: El certificado permanece INCOMPLETO hasta que todas las unidades aprueben o marquen no aplica.",
    50,
    y + 10,
    { width: 495, align: "center" }
  );

  y += 70;
  firma(doc, 60, y, 200, t.nombres, `C.C. ${t.cedula}  ·  Trabajador`);
  firma(doc, 330, y, 200, exp.empleador.representante, exp.empleador.cargoRepresentante || "Representante legal");

  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
    `${exp.empleador.ciudad}, ${fechaLarga(exp.pazSalvo?.fechaEmision || exp.trabajador.fechaSalida)}  ·  Código de expediente ${exp.codigo}`,
    40,
    780,
    { width: 515, align: "center" }
  );

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ filePath, fileName }));
    stream.on("error", reject);
  });
}

export function generarLiquidacionPdf(exp) {
  const calc = calcularLiquidacion(exp);
  const dir = uploadDir(exp.id);
  const fileName = `liquidacion-${exp.codigo}.pdf`;
  const filePath = path.join(dir, fileName);
  const doc = new PDFKit({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  headerBox(doc, "LIQUIDACIÓN DE HABERES", `${exp.empleador.razonSocial}  ·  Talento Humano`);

  const t = exp.trabajador;
  doc.font("Helvetica").fontSize(8.5).fillColor("#222").text(
    "Según lo solicitado por Talento Humano se realiza el cálculo por liquidación de haberes del siguiente ex trabajador, de conformidad con el Código del Trabajo de la República del Ecuador.",
    40,
    118,
    { width: 515 }
  );

  doc.rect(40, 148, 515, 88).strokeColor(LINE).stroke();
  kv(doc, "Nombre", t.nombres, 50, 154, 250);
  kv(doc, "Cédula", t.cedula, 310, 154, 110);
  kv(doc, "Cargo", t.cargo, 430, 154, 115);
  kv(doc, "Ingreso", fechaLarga(t.fechaIngreso), 50, 186, 160);
  kv(doc, "Salida", fechaLarga(t.fechaSalida), 220, 186, 160);
  kv(doc, "Sueldo mensual", `$ ${fmtMoney(calc.sueldo)}`, 390, 186, 150);
  kv(
    doc,
    "Tiempo de servicio",
    `${calc.servicio.years} año(s), ${calc.servicio.months} mes(es) y ${calc.servicio.days} día(s)`,
    50,
    218,
    250
  );
  kv(doc, "Causa", calc.causa.nombre, 310, 218, 230);

  doc.rect(40, 246, 515, 28).fill("#f4ead0");
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8);
  doc.text(`Sueldo / mes  $ ${fmtMoney(calc.sueldo)}`, 50, 254);
  doc.text(`Décimo 3.º / mes  $ ${fmtMoney(calc.d3roMes)}`, 190, 254);
  doc.text(`Décimo 4.º / mes  $ ${fmtMoney(calc.d4toMes)}`, 340, 254);
  doc.text(`Vacaciones / día  $ ${fmtMoney(calc.valorDia)}`, 470, 254, { width: 80 });

  let y = 286;
  const row = (concepto, valor, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor("#111");
    doc.text(concepto, 50, y, { width: 400 });
    doc.text(valor === "" ? "" : `$ ${fmtMoney(valor)}`, 450, y, { width: 95, align: "right" });
    y += 14;
  };

  doc.rect(40, y, 515, 16).fill(NAVY);
  doc.fillColor("#f8f1d8").font("Helvetica-Bold").fontSize(8).text("INGRESOS / HABERES", 50, y + 4);
  doc.text("VALOR", 450, y + 4, { width: 95, align: "right" });
  y += 20;
  for (const i of calc.ingresos) {
    if (i.valor === 0 && ["despido", "fondos", "otros"].includes(i.id)) continue;
    row(i.concepto, i.valor);
  }
  row("TOTAL INGRESOS", calc.totalIngresos, true);

  y += 6;
  doc.rect(40, y, 515, 16).fill(NAVY);
  doc.fillColor("#f8f1d8").font("Helvetica-Bold").fontSize(8).text("EGRESOS / DEDUCCIONES", 50, y + 4);
  doc.text("VALOR", 450, y + 4, { width: 95, align: "right" });
  y += 20;
  for (const e of calc.egresos) {
    row(e.concepto, e.valor);
  }
  row("TOTAL EGRESOS", calc.totalEgresos, true);

  y += 8;
  doc.rect(40, y, 515, 22).fill("#1c6b5a");
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(10).text("NETO A RECIBIR", 50, y + 6);
  doc.text(`$ ${fmtMoney(calc.neto)}`, 450, y + 6, { width: 95, align: "right" });

  y += 36;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(NAVY).text("Base legal y observaciones", 40, y);
  y += 12;
  doc.font("Helvetica").fontSize(8).fillColor("#222").text(
    `${calc.causa.baseLegal}. ${exp.terminacion?.observaciones || ""} Los décimos se calculan de forma proporcional (base/12 × meses + base/360 × días). Las vacaciones usan el factor (sueldo × 12) / 360. El aporte IESS se aplica sobre la remuneración proporcional del mes de salida. Valores expresados en dólares de los Estados Unidos de América.`,
    40,
    y,
    { width: 515, align: "justify", lineGap: 1.5 }
  );

  y += 70;
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
    `${exp.empleador.ciudad}, ${fechaLarga(exp.liquidacion?.fechaEmision || t.fechaSalida)}`,
    40,
    y,
    { width: 515, align: "right" }
  );

  y += 50;
  firma(doc, 40, y, 165, exp.liquidacion?.elaboradoPor || "Contador/a", "Elaborado");
  firma(doc, 215, y, 165, exp.liquidacion?.revisadoPor || "Talento Humano", "Revisado");
  firma(doc, 390, y, 165, exp.empleador.representante, "Aprobado");

  y += 70;
  firma(doc, 215, y, 165, t.nombres, "Recibí conforme  ·  Trabajador");

  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(
    `Expediente ${exp.codigo}  ·  Documento generado por SIGEL Paz y Salvo  ·  Uso académico / demostración de automatización`,
    40,
    780,
    { width: 515, align: "center" }
  );

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ filePath, fileName, calculo: calc }));
    stream.on("error", reject);
  });
}

export function generarEvidenciaPdf({ filePath, titulo, cuerpo, pie }) {
  const doc = new PDFKit({ size: "A4", margin: 56 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  doc.rect(56, 48, 483, 8).fill(NAVY);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14).text(titulo, 56, 72, { width: 483, align: "center" });
  doc.moveTo(56, 98).lineTo(539, 98).strokeColor(GOLD).lineWidth(1.2).stroke();
  doc.fillColor("#222").font("Helvetica").fontSize(10).text(cuerpo, 56, 118, { width: 483, align: "justify", lineGap: 4 });
  if (pie) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(pie, 56, 700, { width: 483, align: "center" });
  }
  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

export function listarAnexos(exp) {
  const anexos = [];
  if (exp.terminacion?.evidencia) {
    anexos.push({
      titulo: "Documento de terminación / aviso",
      unidad: "Talento Humano",
      ...exp.terminacion.evidencia,
    });
  }
  for (const dep of exp.departamentos || []) {
    for (const r of dep.requisitos || []) {
      if (!r.evidencia) continue;
      anexos.push({
        titulo: r.etiqueta,
        unidad: dep.nombre,
        ...r.evidencia,
      });
    }
  }
  return anexos;
}

function waitPdf(doc, filePath) {
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

async function generarIndiceAnexos(exp, anexos, filePath) {
  const doc = new PDFKit({ size: "A4", margin: 48 });
  headerBox(doc, "EXPEDIENTE DE DESVINCULACIÓN — ANEXOS", `${exp.codigo}  ·  ${exp.trabajador.nombres}`);
  doc.font("Helvetica").fontSize(9).fillColor("#222").text(
    "Este tomo reúne el certificado de paz y salvo, la liquidación de haberes y los documentos de respaldo adjuntos a cada requisito, en el mismo orden del expediente físico.",
    40,
    122,
    { width: 515 }
  );
  doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("Índice de documentos", 40, 160);
  let y = 180;
  const items = [
    { n: "01", titulo: "Certificado de paz y salvo para el pago de liquidaciones", unidad: "Expediente" },
    { n: "02", titulo: "Liquidación de haberes", unidad: "Talento Humano / Financiero" },
    ...anexos.map((a, i) => ({
      n: String(i + 3).padStart(2, "0"),
      titulo: a.titulo,
      unidad: a.unidad,
    })),
  ];
  for (const item of items) {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text(item.n, 48, y, { width: 28 });
    doc.font("Helvetica").fontSize(9).fillColor("#111").text(item.titulo, 80, y, { width: 330 });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(item.unidad, 410, y, { width: 135, align: "right" });
    y += 18;
  }
  return waitPdf(doc, filePath);
}

async function appendFileToPdf(merged, filePath) {
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const src = await PDFLibDocument.load(data, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
    return;
  }
  const page = merged.addPage([595.28, 841.89]);
  let img;
  try {
    if (ext === ".png") img = await merged.embedPng(data);
    else img = await merged.embedJpg(data);
  } catch {
    const { width, height } = page.getSize();
    page.drawText("Anexo en formato no incrustable. Consulte el archivo original en el expediente digital.", {
      x: 50,
      y: height / 2,
      size: 11,
    });
    return;
  }
  const { width, height } = page.getSize();
  const margin = 36;
  const maxW = width - margin * 2;
  const maxH = height - margin * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, {
    x: (width - w) / 2,
    y: (height - h) / 2,
    width: w,
    height: h,
  });
}

export async function generarExpedienteCompleto(exp) {
  const paz = await generarPazYSalvo(exp);
  const liq = await generarLiquidacionPdf(exp);
  const dir = uploadDir(exp.id);
  const anexos = listarAnexos(exp);
  const indicePath = path.join(dir, `_indice-${exp.codigo}.pdf`);
  await generarIndiceAnexos(exp, anexos, indicePath);

  const merged = await PDFLibDocument.create();
  const parts = [paz.filePath, liq.filePath, indicePath];
  for (const a of anexos) {
    parts.push(path.join(dir, a.storedName));
  }
  for (const p of parts) {
    if (fs.existsSync(p)) await appendFileToPdf(merged, p);
  }
  const fileName = `expediente-completo-${exp.codigo}.pdf`;
  fs.writeFileSync(path.join(dir, fileName), await merged.save());
  return { fileName, paz, liq, anexos: anexos.length };
}
