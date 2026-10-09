import { type Fecha, maxFecha, minFecha, sumarDias } from '../../common/utils/fechas.js';

/** Rango de fechas inclusivo; `fin` null = abierto (infinito). */
export interface RangoFechas {
  inicio: Fecha;
  fin: Fecha | null;
}

export const esRangoValido = (rango: RangoFechas): boolean =>
  rango.fin === null || rango.fin >= rango.inicio;

export function rangosSeSolapan(a: RangoFechas, b: RangoFechas): boolean {
  return (a.fin === null || a.fin >= b.inicio) && (b.fin === null || b.fin >= a.inicio);
}

export function contieneFecha(rango: RangoFechas, fecha: Fecha): boolean {
  return rango.inicio <= fecha && (rango.fin === null || fecha <= rango.fin);
}

/** Tramos del rango anterior que quedan por fuera del nuevo (a lo sumo dos). */
export function tramosExcluidos(anterior: RangoFechas, nuevo: RangoFechas): RangoFechas[] {
  const tramos: RangoFechas[] = [];
  if (nuevo.inicio > anterior.inicio) {
    const diaPrevio = sumarDias(nuevo.inicio, -1);
    tramos.push({
      inicio: anterior.inicio,
      fin: anterior.fin === null ? diaPrevio : minFecha(anterior.fin, diaPrevio),
    });
  }
  if (nuevo.fin !== null && (anterior.fin === null || nuevo.fin < anterior.fin)) {
    tramos.push({
      inicio: maxFecha(sumarDias(nuevo.fin, 1), anterior.inicio),
      fin: anterior.fin,
    });
  }
  return tramos;
}
