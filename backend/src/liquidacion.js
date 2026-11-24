import { SBU_2026, causaPorId } from "./catalogos.js";

function parseISO(s) {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function money(n) {
  const v = Number.isFinite(n) ? n : 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function fmtMoney(n) {
  return money(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function mesesYDias(inicio, fin) {
  const a = parseISO(inicio);
  const b = parseISO(fin);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  let days;
  if (a.d === 1) {
    days = b.d;
  } else {
    days = b.d - a.d;
    if (days < 0) {
      months -= 1;
      days += 30;
    }
  }
  if (months < 0) return { months: 0, days: 0 };
  return { months, days };
}

export function tiempoServicio(ingreso, salida) {
  const a = parseISO(ingreso);
  const b = parseISO(salida);
  let years = b.y - a.y;
  let months = b.m - a.m;
  let days = b.d - a.d;
  if (days < 0) {
    months -= 1;
    days += 30;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0, days: 0 };
  return { years, months, days };
}

export function periodoDecimoTercero(salida) {
  const b = parseISO(salida);
  const startYear = b.m === 12 ? b.y : b.y - 1;
  return { start: `${startYear}-12-01`, end: salida, etiqueta: `Dic ${startYear} – ${salida}` };
}

export function periodoDecimoCuarto(salida) {
  const b = parseISO(salida);
  const startYear = b.m < 8 ? b.y - 1 : b.y;
  return { start: `${startYear}-08-01`, end: salida, etiqueta: `Ago ${startYear} – ${salida}` };
}

function proporcional(baseMensual, meses, dias) {
  return money((baseMensual / 12) * meses + (baseMensual / 360) * dias);
}

export function calcularLiquidacion(exp) {
  const sueldo = Number(exp.trabajador?.sueldo || 0);
  const sbu = Number(exp.liquidacion?.sbu || SBU_2026);
  const ingreso = exp.trabajador?.fechaIngreso;
  const salida = exp.trabajador?.fechaSalida;
  const vacacionesDias = Number(exp.liquidacion?.vacacionesPendientes || 0);
  const fondosReserva = Boolean(exp.liquidacion?.incluirFondosReserva);
  const anticipos = Number(exp.liquidacion?.anticipos || 0);
  const otrosIngresos = Number(exp.liquidacion?.otrosIngresos || 0);
  const otrasDeducciones = Number(exp.liquidacion?.otrasDeducciones || 0);
  const diasMesSalida = Number(exp.liquidacion?.diasTrabajadosMesSalida || 0);
  const aporteIessPct = Number(exp.liquidacion?.aporteIessPct ?? 9.45);

  if (!ingreso || !salida || !sueldo) {
    return {
      valido: false,
      mensaje: "Faltan sueldo, fecha de ingreso o fecha de salida.",
    };
  }

  const servicio = tiempoServicio(ingreso, salida);
  const valorDia = money((sueldo * 12) / 360);
  const valorDiaMes = money(sueldo / 30);
  const d3ro = periodoDecimoTercero(salida);
  const d4to = periodoDecimoCuarto(salida);
  const md3 = mesesYDias(d3ro.start, d3ro.end);
  const md4 = mesesYDias(d4to.start, d4to.end);

  const causa = causaPorId(exp.terminacion?.causaId);
  const remuneracionProporcional = money(valorDiaMes * diasMesSalida);
  const vacacionesValor = money(valorDia * vacacionesDias);
  const decimoTercero = proporcional(sueldo, md3.months, md3.days);
  const decimoCuarto = proporcional(sbu, md4.months, md4.days);

  let desahucio = 0;
  if (causa?.aplicaDesahucio) {
    desahucio = money(0.25 * sueldo * servicio.years);
  }

  let indemnizacionDespido = 0;
  if (causa?.aplicaDespido) {
    if (servicio.years < 3) {
      indemnizacionDespido = money(sueldo * 3);
    } else {
      indemnizacionDespido = money(sueldo * Math.min(servicio.years, 25));
    }
  }

  const fondos = fondosReserva ? money(sueldo * 0.0833) : 0;
  const iess = money(remuneracionProporcional * (aporteIessPct / 100));

  const ingresos = [
    { id: "remuneracion", concepto: `Remuneración proporcional (${diasMesSalida} días del mes de salida)`, valor: remuneracionProporcional },
    { id: "vacaciones", concepto: `Vacaciones pendientes (${vacacionesDias} días × $ ${fmtMoney(valorDia)})`, valor: vacacionesValor },
    {
      id: "d3ro",
      concepto: `Décimo tercer sueldo proporcional (${md3.months} mes(es) y ${md3.days} día(s) — ${d3ro.etiqueta})`,
      valor: decimoTercero,
    },
    {
      id: "d4to",
      concepto: `Décimo cuarto sueldo proporcional (${md4.months} mes(es) y ${md4.days} día(s) — SBU $ ${fmtMoney(sbu)})`,
      valor: decimoCuarto,
    },
    { id: "desahucio", concepto: `Bonificación por desahucio (25% × $ ${fmtMoney(sueldo)} × ${servicio.years} año(s))`, valor: desahucio },
    { id: "despido", concepto: "Indemnización por despido intempestivo (Art. 188 CT)", valor: indemnizacionDespido },
    { id: "fondos", concepto: "Fondos de reserva (8,33% de la última remuneración, si no se pagaron mensualizados)", valor: fondos },
    { id: "otros", concepto: "Otros ingresos / valores a favor", valor: money(otrosIngresos) },
  ];

  const egresos = [
    { id: "iess", concepto: `Aporte personal IESS ${fmtMoney(aporteIessPct)}% sobre remuneración proporcional`, valor: iess },
    { id: "anticipos", concepto: "Anticipos de remuneración y préstamos internos", valor: money(anticipos) },
    { id: "otras", concepto: "Otras deducciones", valor: money(otrasDeducciones) },
  ];

  const totalIngresos = money(ingresos.reduce((s, i) => s + i.valor, 0));
  const totalEgresos = money(egresos.reduce((s, i) => s + i.valor, 0));
  const neto = money(totalIngresos - totalEgresos);

  return {
    valido: true,
    sbu,
    sueldo: money(sueldo),
    valorDia,
    valorDiaMes,
    d3roMes: money(sueldo / 12),
    d4toMes: money(sbu / 12),
    servicio,
    d3ro: { ...d3ro, ...md3 },
    d4to: { ...d4to, ...md4 },
    causa: causa
      ? { id: causa.id, nombre: causa.nombre, baseLegal: causa.baseLegal }
      : { id: "", nombre: "No identificada", baseLegal: "" },
    ingresos,
    egresos,
    totalIngresos,
    totalEgresos,
    neto,
    calculadoEn: new Date().toISOString(),
  };
}

export function pazSalvoCompleto(departamentos = []) {
  if (!departamentos.length) return false;
  return departamentos.every((d) => d.estado === "aprobado" || d.estado === "no_aplica");
}

export function fechaLarga(iso) {
  if (!iso) return "—";
  const { y, m, d } = parseISO(iso);
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

export function toISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
