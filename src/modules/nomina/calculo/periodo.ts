import { BadRequestException } from '@nestjs/common';
import {
  esFechaValida,
  inicioSemana,
  partesFecha,
  sumarDias,
  type Fecha,
} from '../../../common/utils/fechas.js';

export const DIAS_MES_COMERCIAL = 30;
export const DIAS_SEMANA = 7;
export const ANIO_MINIMO_NOMINA = 2024;
export const ANIO_MAXIMO_NOMINA = 2100;

export interface RangoFechas {
  desde: Fecha;
  hasta: Fecha;
}

/** Datos que identifican un periodo (coinciden con las columnas de `LiquidacionNomina`). */
export interface DatosPeriodo {
  fechaInicio: Fecha;
  fechaFin: Fecha;
}

/** Semana de lunes a domingo; la nómina se liquida siempre por semana. */
export interface Periodo extends DatosPeriodo {
  anio: number;
  diasNominales: typeof DIAS_SEMANA;
}

/** Periodo de la semana (lunes a domingo) que contiene `fecha`. */
export function construirPeriodo(fecha: Fecha): Periodo {
  if (!esFechaValida(fecha)) {
    throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD y ser válida');
  }
  const fechaInicio = inicioSemana(fecha);
  const { anio } = partesFecha(fechaInicio);
  if (anio < ANIO_MINIMO_NOMINA || anio > ANIO_MAXIMO_NOMINA) {
    throw new BadRequestException(
      `El año debe estar entre ${ANIO_MINIMO_NOMINA} y ${ANIO_MAXIMO_NOMINA}`,
    );
  }
  return {
    anio,
    fechaInicio,
    fechaFin: sumarDias(fechaInicio, DIAS_SEMANA - 1),
    diasNominales: DIAS_SEMANA,
  };
}

/** Reconstruye el periodo de una liquidación guardada. */
export function periodoDe(datos: DatosPeriodo): Periodo {
  return construirPeriodo(datos.fechaInicio);
}

/** "2026-10-05_2026-10-11" (nombres de archivo). */
export function sufijoPeriodo(periodo: DatosPeriodo): string {
  return `${periodo.fechaInicio}_${periodo.fechaFin}`;
}

/** "Semana del 2026-10-05 al 2026-10-11". */
export function describirPeriodo(periodo: DatosPeriodo): string {
  return `Semana del ${periodo.fechaInicio} al ${periodo.fechaFin}`;
}
