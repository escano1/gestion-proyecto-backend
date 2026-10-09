/** Fecha de calendario en formato ISO `YYYY-MM-DD`, sin hora ni zona horaria. */
export type Fecha = string;

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ZONA_COLOMBIA = 'America/Bogota';

export function esFechaValida(valor: unknown): valor is Fecha {
  if (typeof valor !== 'string' || !FORMATO_FECHA.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return (
    fecha.getUTCFullYear() === a &&
    fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d
  );
}

function aUtc(fecha: Fecha): Date {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function deUtc(fecha: Date): Fecha {
  return fecha.toISOString().slice(0, 10);
}

export function hoyColombia(ahora: Date = new Date()): Fecha {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_COLOMBIA }).format(
    ahora,
  );
}

export function sumarDias(fecha: Fecha, dias: number): Fecha {
  const f = aUtc(fecha);
  f.setUTCDate(f.getUTCDate() + dias);
  return deUtc(f);
}

/** Lunes de la semana (lunes a domingo) que contiene la fecha. */
export function inicioSemana(fecha: Fecha): Fecha {
  const diaSemana = (aUtc(fecha).getUTCDay() + 6) % 7; // lunes = 0
  return sumarDias(fecha, -diaSemana);
}

export function ultimoDiaMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function construirFecha(anio: number, mes: number, dia: number): Fecha {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function partesFecha(fecha: Fecha): {
  anio: number;
  mes: number;
  dia: number;
} {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return { anio, mes, dia };
}

export const maxFecha = (a: Fecha, b: Fecha): Fecha => (a > b ? a : b);
export const minFecha = (a: Fecha, b: Fecha): Fecha => (a < b ? a : b);

export function primerDiaMes(fecha: Fecha): Fecha {
  return `${fecha.slice(0, 7)}-01`;
}

export function ultimaFechaMes(fecha: Fecha): Fecha {
  const { anio, mes } = partesFecha(fecha);
  return construirFecha(anio, mes, ultimoDiaMes(anio, mes));
}
