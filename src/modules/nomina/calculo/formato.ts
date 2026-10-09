import { Decimal, type ValorDecimal } from '../../../common/utils/dinero.js';

const SEPARADOR_MILES = /\B(?=(\d{3})+(?!\d))/g;
const ZONA_COLOMBIA = 'America/Bogota';

/** Número con convención colombiana: miles con punto y decimales con coma ("1.234,5"). */
export function formatearNumero(valor: ValorDecimal, maxDecimales = 2): string {
  const d = new Decimal(valor).toDecimalPlaces(maxDecimales, Decimal.ROUND_HALF_UP);
  const [entero, decimales] = d.abs().toFixed().split('.');
  const signo = d.isNegative() && !d.isZero() ? '-' : '';
  const conMiles = entero.replace(SEPARADOR_MILES, '.');
  return `${signo}${decimales ? `${conMiles},${decimales}` : conMiles}`;
}

/** Moneda colombiana: "$ 1.253.048"; con centavos solo si los hay ("$ 9.545,45"). */
export function formatearPesos(valor: ValorDecimal): string {
  const d = new Decimal(valor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const [entero, centavos] = d.abs().toFixed(2).split('.');
  const conMiles = entero.replace(SEPARADOR_MILES, '.');
  const signo = d.isNegative() && !d.isZero() ? '-' : '';
  return `${signo}$ ${centavos === '00' ? conMiles : `${conMiles},${centavos}`}`;
}

/** Fracción como porcentaje: 0.35 → "35 %", 0.012 → "1,2 %". */
export function formatearPorcentaje(fraccion: ValorDecimal): string {
  return `${formatearNumero(new Decimal(fraccion).times(100))} %`;
}

/** Fecha y hora de Colombia en formato "2026-10-08 23:40". */
export function formatearFechaHoraColombia(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')} ${parte('hour')}:${parte('minute')}`;
}
