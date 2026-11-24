import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { requisitosIniciales } from "./catalogos.js";
import { calcularLiquidacion } from "./liquidacion.js";
import { generarEvidenciaPdf, generarExpedienteCompleto } from "./pdf.js";
import { ROOT, ensureDirs, getExpediente, upsertExpediente, uploadDir } from "./store.js";

export const CASO_ID = "exp-andina-nunez-2026";

export function casoHipotetico() {
  const departamentos = requisitosIniciales();
  const aprobaciones = {
    jefatura: {
      responsable: "Ing. Marco Antonio Lema Guambo",
      cargoResponsable: "Jefe de Operaciones y Logística",
      fecha: "2026-11-10",
      estado: "aprobado",
      observaciones: "Entrega de cargo e informe de gestión del área de bodega recibidos.",
      requisitos: { informe_labores: "si", acta_entrega: "si", archivos_foliados: "si", transferencia: "si", bloqueo_equipo: "si" },
    },
    talento_humano: {
      responsable: "Lcda. Verónica Alexandra Pazmiño Ríos",
      cargoResponsable: "Analista de Talento Humano",
      fecha: "2026-11-12",
      estado: "aprobado",
      observaciones: "Vacaciones pendientes: 18 días. Certificado de trabajo listo.",
      requisitos: { contrato_expediente: "si", vacaciones: "si", asistencia: "si", certificado_trabajo: "si" },
    },
    financiero: {
      responsable: "C.P.A. Diego Fernando Cevallos Mora",
      cargoResponsable: "Contador general",
      fecha: "2026-11-13",
      estado: "aprobado",
      observaciones: "Sin anticipos ni caja chica pendiente. IESS al día hasta octubre 2026.",
      requisitos: { anticipos: "si", caja_chica: "si", roles: "si", liquidacion_calculada: "si" },
    },
    sistemas: {
      responsable: "Ing. Paola Belén Ortiz Vinueza",
      cargoResponsable: "Coordinadora de TI",
      fecha: "2026-11-11",
      estado: "aprobado",
      observaciones: "Cuentas dadas de baja. Laptop HP-OP-18 recibida con acta.",
      requisitos: { cuentas: "si", equipos: "si", backup: "si" },
    },
    bodega: {
      responsable: "Sr. Luis Enrique Guambo Pilamunga",
      cargoResponsable: "Guardalmacén",
      fecha: "2026-11-10",
      estado: "aprobado",
      observaciones: "Inventario de estantería A-C conciliado. EPP y radio entregados.",
      requisitos: { inventario: "si", epp: "si", llaves: "si" },
    },
    adquisiciones: {
      responsable: "Ing. Karina Elizabeth Muñoz Lara",
      cargoResponsable: "Asistente de adquisiciones",
      fecha: "2026-11-11",
      estado: "aprobado",
      observaciones: "No administraba contratos vigentes ni procesos SERCOP.",
      requisitos: { admin_contrato: "na", procesos: "na", expedientes_compra: "na" },
    },
  };

  for (const dep of departamentos) {
    const a = aprobaciones[dep.id];
    if (!a) continue;
    dep.responsable = a.responsable;
    dep.cargoResponsable = a.cargoResponsable;
    dep.fecha = a.fecha;
    dep.estado = a.estado;
    dep.observaciones = a.observaciones;
    dep.requisitos = dep.requisitos.map((r) => ({ ...r, valor: a.requisitos[r.id] || "pendiente" }));
  }

  return {
    id: CASO_ID,
    codigo: "EXP-ALC-2026-014",
    hipotetico: true,
    creadoEn: "2026-11-07T09:00:00.000Z",
    actualizadoEn: new Date().toISOString(),
    empleador: {
      razonSocial: "AndesLogística del Centro Cía. Ltda.",
      ruc: "0691847365001",
      ciudad: "Riobamba",
      direccion: "Av. Lizarzaburu Nro. 24-18 y Francia, Riobamba, Chimborazo",
      telefono: "(03) 296-4410",
      correo: "talento.humano@andeslogistica.ec",
      representante: "Ing. Patricia Elena Vásconez Cárdenas",
      cargoRepresentante: "Gerente general",
      actividad: "Logística y distribución de insumos agrícolas",
    },
    trabajador: {
      nombres: "Carlos Eduardo Núñez Cabrera",
      cedula: "0603984712",
      cargo: "Coordinador de Bodega y Despacho",
      unidad: "Operaciones y Logística",
      jefeInmediato: "Ing. Marco Antonio Lema Guambo",
      tipoVinculacion: "Contrato indefinido — Código del Trabajo",
      fechaIngreso: "2022-03-03",
      fechaSalida: "2026-11-14",
      sueldo: 880,
      correo: "carlos.nunez@andeslogistica.ec",
      telefono: "0998123344",
      domicilio: "Cdla. La Paz, calle Los Álamos E4-12, Riobamba",
    },
    terminacion: {
      causaId: "desahucio_trabajador",
      fechaAviso: "2026-10-28",
      observaciones:
        "El trabajador presentó aviso de desahucio el 28 de octubre de 2026, con efectos a partir del 14 de noviembre de 2026 (más de 15 días de anticipación). Motivo: continuidad de estudios de posgrado en jornada completa.",
    },
    liquidacion: {
      sbu: 470,
      vacacionesPendientes: 18,
      diasTrabajadosMesSalida: 14,
      incluirFondosReserva: false,
      anticipos: 0,
      otrosIngresos: 0,
      otrasDeducciones: 0,
      aporteIessPct: 9.45,
      elaboradoPor: "C.P.A. Diego Fernando Cevallos Mora",
      revisadoPor: "Lcda. Verónica Alexandra Pazmiño Ríos",
      fechaEmision: "2026-11-14",
    },
    pazSalvo: {
      fechaEmision: "2026-11-14",
    },
    departamentos,
    evidencias: [],
    documentos: {
      pazYSalvo: null,
      liquidacion: null,
      expediente: null,
    },
  };
}

async function crearPdfAdjunto(exp, p) {
  const dir = uploadDir(exp.id);
  const id = uuid();
  const stored = `${id}.pdf`;
  const filePath = path.join(dir, stored);
  await generarEvidenciaPdf({
    filePath,
    titulo: p.titulo,
    cuerpo: p.cuerpo,
    pie: "Documento ficticio — caso hipotético académico SIGEL / Proyecto Paz y Salvo",
  });
  return {
    id,
    tipo: p.tipo,
    nombreOriginal: p.nombreOriginal,
    storedName: stored,
    mime: "application/pdf",
    size: fs.statSync(filePath).size,
    subidoEn: new Date().toISOString(),
  };
}

async function adjuntarEvidencias(exp) {
  const piezas = [
    {
      alcance: "terminacion",
      tipo: "terminacion",
      nombreOriginal: "aviso-desahucio-nunez.pdf",
      titulo: "AVISO DE DESAHUCIO DEL TRABAJADOR",
      cuerpo: `Riobamba, 28 de octubre de 2026\n\nSeñora Ingeniera\nPatricia Elena Vásconez Cárdenas\nGERENTE GENERAL\nANDESLOGÍSTICA DEL CENTRO CÍA. LTDA.\nPresente.-\n\nDe mi consideración:\n\nYo, Carlos Eduardo Núñez Cabrera, con cédula de ciudadanía 0603984712, quien me desempeño como Coordinador de Bodega y Despacho desde el 3 de marzo de 2022, presento formalmente el aviso de desahucio previsto en los artículos 184 y 185 del Código del Trabajo, a fin de que se tenga por terminada la relación laboral a partir del 14 de noviembre de 2026.\n\nLa decisión obedece a motivos personales de formación académica y se formula con más de quince días de anticipación. Solicito se disponga el trámite de paz y salvo interno y la liquidación de haberes que me correspondan, incluida la bonificación por desahucio.\n\nAtentamente,\nCarlos Eduardo Núñez Cabrera`,
    },
    {
      dep: "jefatura",
      req: "informe_labores",
      nombreOriginal: "informe-entrega-cargo.pdf",
      titulo: "INFORME DE LABORES Y ENTREGA DE CARGO",
      cuerpo: `Unidad de Operaciones y Logística. Riobamba, 10 de noviembre de 2026.\n\nEl jefe inmediato certifica la recepción del informe de labores del coordinador Carlos Eduardo Núñez Cabrera, correspondiente al periodo 2025-2026, con el detalle de despachos, inventario cíclico y personal a cargo.`,
    },
    {
      dep: "jefatura",
      req: "acta_entrega",
      nombreOriginal: "acta-entrega-recepcion.pdf",
      titulo: "ACTA DE ENTREGA-RECEPCIÓN DE DOCUMENTOS",
      cuerpo: `Se entrega el archivo físico y magnético de guías de remisión, kardex y oficios de la unidad. Recibe: Srta. Mónica Robalino. Fecha: 10 de noviembre de 2026.`,
    },
    {
      dep: "jefatura",
      req: "archivos_foliados",
      nombreOriginal: "constancia-archivos-foliados.pdf",
      titulo: "CONSTANCIA DE ARCHIVOS FOLIADOS",
      cuerpo: `Se deja constancia de que los expedientes físicos de bodega 2024-2026 fueron foliados (fs. 1 a 186) y ubicados en el archivo de la unidad.`,
    },
    {
      dep: "jefatura",
      req: "transferencia",
      nombreOriginal: "acta-transferencia-informacion.pdf",
      titulo: "TRANSFERENCIA DE INFORMACIÓN Y DOCUMENTACIÓN",
      cuerpo: `Se transfiere el acceso al kardex digital, carpetas compartidas de despacho y el listado de proveedores frecuentes a la analista de relevo.`,
    },
    {
      dep: "jefatura",
      req: "bloqueo_equipo",
      nombreOriginal: "constancia-bloqueo-equipo.pdf",
      titulo: "BLOQUEO Y ENTREGA DE EQUIPO INFORMÁTICO",
      cuerpo: `El equipo de escritorio OP-BOD-04 fue bloqueado y remitido a Tecnologías de la Información el 10 de noviembre de 2026.`,
    },
    {
      dep: "talento_humano",
      req: "contrato_expediente",
      nombreOriginal: "expediente-personal.pdf",
      titulo: "CONSTANCIA DE EXPEDIENTE DE PERSONAL",
      cuerpo: `Talento Humano certifica que el contrato indefinido, acciones de personal y hojas de vida del señor Núñez se encuentran actualizados en el expediente EXP-ALC-2026-014.`,
    },
    {
      dep: "talento_humano",
      req: "vacaciones",
      nombreOriginal: "control-vacaciones.pdf",
      titulo: "CONTROL DE VACACIONES PENDIENTES",
      cuerpo: `Saldo de vacaciones: 18 días. No existen solicitudes en trámite. El valor se incorpora a la liquidación de haberes.`,
    },
    {
      dep: "talento_humano",
      req: "asistencia",
      nombreOriginal: "cierre-asistencia.pdf",
      titulo: "CIERRE DE ASISTENCIA",
      cuerpo: `Se cierra el registro de asistencia, permisos y atrasos al 14 de noviembre de 2026. Sin novedades pendientes de descuento.`,
    },
    {
      dep: "talento_humano",
      req: "certificado_trabajo",
      nombreOriginal: "certificado-trabajo.pdf",
      titulo: "CERTIFICADO DE TRABAJO",
      cuerpo: `AndesLogística del Centro Cía. Ltda. certifica que Carlos Eduardo Núñez Cabrera laboró como Coordinador de Bodega y Despacho desde el 3 de marzo de 2022 hasta el 14 de noviembre de 2026.`,
    },
    {
      dep: "financiero",
      req: "anticipos",
      nombreOriginal: "certificado-no-adeudar.pdf",
      titulo: "CERTIFICADO DE NO ADEUDAR",
      cuerpo: `Contabilidad certifica que no registra anticipos de remuneración ni préstamos internos al 13 de noviembre de 2026.`,
    },
    {
      dep: "financiero",
      req: "caja_chica",
      nombreOriginal: "cierre-caja-chica.pdf",
      titulo: "CIERRE DE CAJA CHICA",
      cuerpo: `No administró caja chica. Rendiciones de viáticos: ninguna pendiente.`,
    },
    {
      dep: "financiero",
      req: "roles",
      nombreOriginal: "roles-iess.pdf",
      titulo: "ROLES DE PAGO Y APORTES IESS",
      cuerpo: `Aportes al IESS declarados hasta el rol de octubre de 2026. El rol proporcional de noviembre se incluye en la liquidación.`,
    },
    {
      dep: "financiero",
      req: "liquidacion_calculada",
      nombreOriginal: "revision-liquidacion.pdf",
      titulo: "REVISIÓN DEL CÁLCULO DE LIQUIDACIÓN",
      cuerpo: `El contador general revisó décimos, vacaciones, desahucio y aporte IESS. Cálculo conforme al Código del Trabajo.`,
    },
    {
      dep: "sistemas",
      req: "cuentas",
      nombreOriginal: "acta-baja-accesos.pdf",
      titulo: "BAJA DE CUENTAS Y ACCESOS",
      cuerpo: `Baja de correo corporativo, ERP ANDES-USR-18 y VPN. Fecha: 11 de noviembre de 2026. Ing. Paola Belén Ortiz Vinueza.`,
    },
    {
      dep: "sistemas",
      req: "equipos",
      nombreOriginal: "acta-devolucion-laptop.pdf",
      titulo: "DEVOLUCIÓN DE EQUIPOS",
      cuerpo: `Se recibe laptop HP-OP-18, cargador y mouse en buen estado.`,
    },
    {
      dep: "sistemas",
      req: "backup",
      nombreOriginal: "respaldo-informacion.pdf",
      titulo: "RESPALDO DE INFORMACIÓN INSTITUCIONAL",
      cuerpo: `Respaldo de carpetas institucionales almacenado en FILE-ANDES-01 /Bodega/Nunez_2026.`,
    },
    {
      dep: "bodega",
      req: "inventario",
      nombreOriginal: "acta-inventario-activos.pdf",
      titulo: "ACTA DE INVENTARIO",
      cuerpo: `Inventario de estantería A, B y C conciliado. No existen faltantes ni sobrantes. 10 de noviembre de 2026.`,
    },
    {
      dep: "bodega",
      req: "epp",
      nombreOriginal: "devolucion-epp.pdf",
      titulo: "DEVOLUCIÓN DE EPP Y HERRAMIENTAS",
      cuerpo: `Se reciben casco, chaleco, botas y radio de comunicación.`,
    },
    {
      dep: "bodega",
      req: "llaves",
      nombreOriginal: "entrega-llaves.pdf",
      titulo: "ENTREGA DE LLAVES Y PASES",
      cuerpo: `Se entregan llaves de bodega 1 y 2 y tarjeta de acceso peatonal.`,
    },
  ];

  for (const p of piezas) {
    const item = await crearPdfAdjunto(exp, p);
    if (p.alcance === "terminacion") {
      exp.terminacion.evidencia = item;
    } else {
      const dep = exp.departamentos.find((d) => d.id === p.dep);
      const reqt = dep?.requisitos.find((r) => r.id === p.req);
      if (reqt) reqt.evidencia = item;
    }
  }
}

export async function seedCasoHipotetico() {
  ensureDirs();
  if (getExpediente(CASO_ID)) {
    fs.rmSync(uploadDir(CASO_ID), { recursive: true, force: true });
  }

  const exp = casoHipotetico();
  await adjuntarEvidencias(exp);
  exp.liquidacion.calculo = calcularLiquidacion(exp);

  const out = await generarExpedienteCompleto(exp);
  exp.documentos = {
    pazYSalvo: { fileName: out.paz.fileName, generadoEn: new Date().toISOString() },
    liquidacion: { fileName: out.liq.fileName, generadoEn: new Date().toISOString(), neto: out.liq.calculo.neto },
    expediente: { fileName: out.fileName, generadoEn: new Date().toISOString(), anexos: out.anexos },
  };
  exp.actualizadoEn = new Date().toISOString();
  upsertExpediente(exp);

  const entregables = path.join(ROOT, "..", "entregables");
  fs.mkdirSync(entregables, { recursive: true });
  const dir = uploadDir(exp.id);
  fs.copyFileSync(path.join(dir, out.paz.fileName), path.join(entregables, "Certificado_Paz_y_Salvo.pdf"));
  fs.copyFileSync(path.join(dir, out.liq.fileName), path.join(entregables, "Liquidacion_Laboral.pdf"));
  fs.copyFileSync(path.join(dir, out.fileName), path.join(entregables, "Expediente_Completo.pdf"));
  return exp;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("seed.js")) {
  const exp = await seedCasoHipotetico();
  console.log("Caso hipotético listo:", exp.codigo, "neto $", exp.documentos.liquidacion.neto);
}
