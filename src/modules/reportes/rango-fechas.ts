import { BadRequestException } from '@nestjs/common';
import type { Fecha } from '../../common/utils/fechas.js';

/** Máximo de días (inclusivo) en los reportes de horas, costos y alertas. */
export const MAXIMO_DIAS_REPORTE = 366;

const MS_POR_DIA = 86_400_000;

/** Días del rango contando ambos extremos. */
export function diasDelRango(desde: Fecha, hasta: Fecha): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_POR_DIA) + 1;
}

export function validarRango(
  desde: Fecha,
  hasta: Fecha,
  maximoDias?: number,
): void {
  if (desde > hasta) {
    throw new BadRequestException(
      'La fecha "desde" no puede ser posterior a "hasta"',
    );
  }
  if (maximoDias !== undefined && diasDelRango(desde, hasta) > maximoDias) {
    throw new BadRequestException(
      `El rango de fechas no puede superar ${maximoDias} días`,
    );
  }
}
