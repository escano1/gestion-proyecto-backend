import type { Fecha } from '../../common/utils/fechas.js';

export type EstadoAvance = 'EN_TIEMPO' | 'RETRASADO' | 'ADELANTADO' | 'SIN_HITOS';

export interface HitoParaAvance {
  peso: number;
  porcentajeAvance: number;
  fechaPlaneada: Fecha;
  fechaReal: Fecha | null;
}

export interface PuntoCurva {
  fecha: Fecha;
  planeado: number;
  real: number;
}

export interface AvanceProyecto {
  avanceReal: number;
  avancePlaneado: number;
  estado: EstadoAvance;
  sumaPesos: number;
  curva: PuntoCurva[];
}

/** Puntos porcentuales de diferencia tolerados antes de marcar retraso o adelanto. */
export const TOLERANCIA_AVANCE = 5;

const redondear = (v: number) => Math.round(v * 100) / 100;

/**
 * Avance ponderado por peso de hitos.
 * - Real: Σ(peso × % avance) / Σ peso.
 * - Planeado a la fecha: Σ peso de hitos con fecha planeada ≤ hoy / Σ peso.
 * - Curva S: acumulados planeado (por fecha planeada) vs real (hitos completados por fecha real).
 */
export function calcularAvance(hitos: HitoParaAvance[], hoy: Fecha): AvanceProyecto {
  const sumaPesos = hitos.reduce((s, h) => s + h.peso, 0);
  if (sumaPesos <= 0) {
    return { avanceReal: 0, avancePlaneado: 0, estado: 'SIN_HITOS', sumaPesos: 0, curva: [] };
  }

  const pct = (v: number) => redondear((v / sumaPesos) * 100);
  const avanceReal = pct(hitos.reduce((s, h) => s + (h.peso * h.porcentajeAvance) / 100, 0));
  const avancePlaneado = pct(
    hitos.filter((h) => h.fechaPlaneada <= hoy).reduce((s, h) => s + h.peso, 0),
  );

  const estado: EstadoAvance =
    avanceReal < avancePlaneado - TOLERANCIA_AVANCE
      ? 'RETRASADO'
      : avanceReal > avancePlaneado + TOLERANCIA_AVANCE
        ? 'ADELANTADO'
        : 'EN_TIEMPO';

  const completados = hitos.filter((h) => h.porcentajeAvance >= 100 && h.fechaReal);
  const fechas = [
    ...new Set([
      ...hitos.map((h) => h.fechaPlaneada),
      ...completados.map((h) => h.fechaReal as Fecha),
    ]),
  ].sort();

  const curva = fechas.map((fecha) => ({
    fecha,
    planeado: pct(hitos.filter((h) => h.fechaPlaneada <= fecha).reduce((s, h) => s + h.peso, 0)),
    real: pct(
      completados.filter((h) => (h.fechaReal as Fecha) <= fecha).reduce((s, h) => s + h.peso, 0),
    ),
  }));

  return { avanceReal, avancePlaneado, estado, sumaPesos: redondear(sumaPesos), curva };
}
