export const SBU_2026 = 470;

export const CAUSAS_TERMINACION = [
  {
    id: "desahucio_trabajador",
    nombre: "Desahucio del trabajador (renuncia con aviso previo)",
    baseLegal: "Arts. 184 y 185 del Código del Trabajo",
    descripcion:
      "El trabajador notifica con al menos 15 días de anticipación. Corresponde bonificación del 25% de la última remuneración mensual por cada año de servicio.",
    aplicaDesahucio: true,
    aplicaDespido: false,
  },
  {
    id: "renuncia_voluntaria",
    nombre: "Renuncia voluntaria sin desahucio",
    baseLegal: "Art. 169 numeral 2 del Código del Trabajo",
    descripcion: "Terminación por voluntad del trabajador. Se pagan haberes proporcionales; no hay bonificación por desahucio.",
    aplicaDesahucio: false,
    aplicaDespido: false,
  },
  {
    id: "desahucio_empleador",
    nombre: "Desahucio del empleador",
    baseLegal: "Arts. 184 y 185 del Código del Trabajo",
    descripcion:
      "El empleador notifica el aviso previo. El trabajador recibe la bonificación del 25% de la última remuneración por cada año de servicio.",
    aplicaDesahucio: true,
    aplicaDespido: false,
  },
  {
    id: "despido_intempestivo",
    nombre: "Despido intempestivo",
    baseLegal: "Art. 188 del Código del Trabajo",
    descripcion:
      "Terminación unilateral del empleador sin visto bueno. Indemnización de hasta 3 meses (menos de 3 años) o un mes por año (máximo 25), más bonificación de desahucio.",
    aplicaDesahucio: true,
    aplicaDespido: true,
  },
  {
    id: "visto_bueno",
    nombre: "Visto bueno (empleador o trabajador)",
    baseLegal: "Arts. 172 y 173 del Código del Trabajo",
    descripcion: "Terminación con autorización del inspector del trabajo. Se liquidan haberes; no hay indemnización por despido.",
    aplicaDesahucio: false,
    aplicaDespido: false,
  },
  {
    id: "mutuo_acuerdo",
    nombre: "Mutuo acuerdo de las partes",
    baseLegal: "Art. 169 numeral 1 del Código del Trabajo",
    descripcion: "Las partes acuerdan dar por terminado el contrato. Se pagan haberes acumulados y lo pactado.",
    aplicaDesahucio: false,
    aplicaDespido: false,
  },
  {
    id: "fin_contrato_plazo",
    nombre: "Culminación de contrato a plazo fijo",
    baseLegal: "Art. 184 del Código del Trabajo (bonificación si aplica según tiempo)",
    descripcion: "Vencimiento del plazo contractual. Se liquidan décimos, vacaciones y haberes pendientes.",
    aplicaDesahucio: false,
    aplicaDespido: false,
  },
];

export const DEPARTAMENTOS_DEFAULT = [
  {
    id: "jefatura",
    nombre: "Jefatura inmediata / Unidad administrativa",
    requisitos: [
      { id: "informe_labores", etiqueta: "Informe de labores recibido por el jefe inmediato" },
      { id: "acta_entrega", etiqueta: "Acta de entrega-recepción de documentos a su cargo (físico y/o magnético)" },
      { id: "archivos_foliados", etiqueta: "El servidor deja foliados los archivos físicos" },
      { id: "transferencia", etiqueta: "Transferencia de información y documentación" },
      { id: "bloqueo_equipo", etiqueta: "Bloqueo o entrega del equipo informático" },
    ],
  },
  {
    id: "talento_humano",
    nombre: "Talento Humano",
    requisitos: [
      { id: "contrato_expediente", etiqueta: "Expediente de personal y contrato actualizados" },
      { id: "vacaciones", etiqueta: "Control de vacaciones gozadas y pendientes" },
      { id: "asistencia", etiqueta: "Cierre de asistencia, permisos y atrasos" },
      { id: "certificado_trabajo", etiqueta: "Certificado de trabajo listo para entrega" },
    ],
  },
  {
    id: "financiero",
    nombre: "Contabilidad y Tesorería",
    requisitos: [
      { id: "anticipos", etiqueta: "No adeuda anticipos de remuneración ni préstamos internos" },
      { id: "caja_chica", etiqueta: "Caja chica y rendiciones de gastos cerradas" },
      { id: "roles", etiqueta: "Roles de pago y aportes IESS al día" },
      { id: "liquidacion_calculada", etiqueta: "Cálculo de liquidación revisado" },
    ],
  },
  {
    id: "sistemas",
    nombre: "Tecnologías de la Información",
    requisitos: [
      { id: "cuentas", etiqueta: "Baja de cuentas de correo, ERP y accesos" },
      { id: "equipos", etiqueta: "Devolución de laptop, celular u otros equipos" },
      { id: "backup", etiqueta: "Respaldo de información institucional entregado" },
    ],
  },
  {
    id: "bodega",
    nombre: "Bodega y activos fijos",
    requisitos: [
      { id: "inventario", etiqueta: "Inventario de bienes a su cargo conciliado" },
      { id: "epp", etiqueta: "Devolución de EPP, uniformes y herramientas" },
      { id: "llaves", etiqueta: "Entrega de llaves, tarjetas y pases" },
    ],
  },
  {
    id: "adquisiciones",
    nombre: "Adquisiciones / Compras",
    requisitos: [
      { id: "admin_contrato", etiqueta: "No permanece como administrador de contratos vigentes" },
      { id: "procesos", etiqueta: "No tiene procesos de contratación pendientes" },
      { id: "expedientes_compra", etiqueta: "Entrega de información física y digital de procesos a cargo" },
    ],
  },
];

export function requisitosIniciales() {
  return DEPARTAMENTOS_DEFAULT.map((dep) => ({
    id: dep.id,
    nombre: dep.nombre,
    responsable: "",
    cargoResponsable: "",
    fecha: "",
    observaciones: "",
    estado: "pendiente",
    requisitos: dep.requisitos.map((r) => ({
      ...r,
      valor: "pendiente",
    })),
  }));
}

export function causaPorId(id) {
  return CAUSAS_TERMINACION.find((c) => c.id === id) || null;
}
