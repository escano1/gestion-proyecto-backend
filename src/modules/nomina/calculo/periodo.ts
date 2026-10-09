import { BadRequestException } from '@nestjs/common';
import {
  construirFecha,
  maxFecha,
  minFecha,
  partesFecha,
  ultimoDiaMes,
  type Fecha,
} from '../../../common/utils/fechas.js';
import { TipoPeriodo } from '../nomina.entity.js';

export const DIAS_MES_COMERCIAL = 30;
export const ANIO_MINIMO_NOMINA = 2024;
export const ANIO_MAXIMO_NOMINA = 2100;

const DIAS_QUINCENA = 15;
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export interface RangoFechas {
  desde: Fecha;
  hasta: Fecha;
}

/** Datos que identifican un periodo (coinciden con las columnas de `LiquidacionNomina`). */
export interface DatosPeriodo {
  tipoPeriodo: TipoPeriodo;
  anio: number;
  mes: number;
  quincena: number | null;
  fechaInicio: Fecha;
  fechaFin: Fecha;
}

export interface Periodo extends DatosPeriodo {
  quincena: 1 | 2 | null;
  /** 15 en quincenas y 30 en meses (convención comercial). */
  diasNominales: number;
}

/** Quincena 1 = días 1–15, quincena 2 = 16–fin de mes; mensual = mes completo. */
export function construirPeriodo(
  tipoPeriodo: TipoPeriodo,
  anio: number,
  mes: number,
  quincena?: number | null,
): Periodo {
  if (!Number.isInteger(anio) || anio < ANIO_MINIMO_NOMINA || anio > ANIO_MAXIMO_NOMINA) {
    throw new BadRequestException(
      `El año debe estar entre ${ANIO_MINIMO_NOMINA} y ${ANIO_MAXIMO_NOMINA}`,
    );
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new BadRequestException('El mes debe estar entre 1 y 12');
  }
  const ultimoDia = ultimoDiaMes(anio, mes);
  const tieneQuincena = quincena !== undefined && quincena !== null;

  if (tipoPeriodo === TipoPeriodo.MENSUAL) {
    if (tieneQuincena) {
      throw new BadRequestException('La quincena no aplica a un periodo MENSUAL');
    }
    return {
      tipoPeriodo,
      anio,
      mes,
      quincena: null,
      fechaInicio: construirFecha(anio, mes, 1),
      fechaFin: construirFecha(anio, mes, ultimoDia),
      diasNominales: DIAS_MES_COMERCIAL,
    };
  }
  if (tipoPeriodo !== TipoPeriodo.QUINCENAL) {
    throw new BadRequestException('tipoPeriodo debe ser QUINCENAL o MENSUAL');
  }
  if (quincena !== 1 && quincena !== 2) {
    throw new BadRequestException('La quincena (1 o 2) es obligatoria en un periodo QUINCENAL');
  }
  return {
    tipoPeriodo,
    anio,
    mes,
    quincena,
    fechaInicio: construirFecha(anio, mes, quincena === 1 ? 1 : DIAS_QUINCENA + 1),
    fechaFin: construirFecha(anio, mes, quincena === 1 ? DIAS_QUINCENA : ultimoDia),
    diasNominales: DIAS_QUINCENA,
  };
}

/** Reconstruye el periodo de una liquidación guardada. */
export function periodoDe(datos: DatosPeriodo): Periodo {
  return construirPeriodo(datos.tipoPeriodo, datos.anio, datos.mes, datos.quincena);
}

/**
 * Días según la convención comercial de 30 días por mes: el último día del mes
 * cuenta como día 30 (febrero 16–28 = 15 días) y el día 31 no suma.
 */
export function diasComerciales(desde: Fecha, hasta: Fecha): number {
  if (desde > hasta) return 0;
  const inicio = partesFecha(desde);
  const fin = partesFecha(hasta);
  if (inicio.anio !== fin.anio || inicio.mes !== fin.mes) {
    throw new Error(`diasComerciales: ${desde} y ${hasta} deben pertenecer al mismo mes`);
  }
  const diaInicial = Math.min(inicio.dia, DIAS_MES_COMERCIAL);
  const diaFinal =
    fin.dia === ultimoDiaMes(fin.anio, fin.mes)
      ? DIAS_MES_COMERCIAL
      : Math.min(fin.dia, DIAS_MES_COMERCIAL);
  return Math.max(0, diaFinal - diaInicial + 1);
}

/** Intersección del periodo con el vínculo laboral; null si no se cruzan. */
export function rangoEfectivo(
  periodo: Pick<DatosPeriodo, 'fechaInicio' | 'fechaFin'>,
  fechaIngreso: Fecha,
  fechaRetiro: Fecha | null,
): RangoFechas | null {
  const desde = maxFecha(periodo.fechaInicio, fechaIngreso);
  const hasta = minFecha(periodo.fechaFin, fechaRetiro ?? periodo.fechaFin);
  return desde <= hasta ? { desde, hasta } : null;
}

/** "2026-10-Q2" o "2026-10" (nombres de archivo). */
export function sufijoPeriodo(periodo: Pick<DatosPeriodo, 'anio' | 'mes' | 'quincena'>): string {
  const base = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`;
  return periodo.quincena ? `${base}-Q${periodo.quincena}` : base;
}

/** "Quincena 2 de octubre de 2026 (2026-10-16 a 2026-10-31)". */
export function describirPeriodo(periodo: DatosPeriodo): string {
  const mes = MESES[periodo.mes - 1] ?? String(periodo.mes);
  const nombre = periodo.quincena
    ? `Quincena ${periodo.quincena} de ${mes} de ${periodo.anio}`
    : `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${periodo.anio}`;
  return `${nombre} (${periodo.fechaInicio} a ${periodo.fechaFin})`;
}
