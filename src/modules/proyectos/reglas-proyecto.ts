import type { Proyecto } from './proyecto.entity.js';

type FechasProyecto = Pick<Proyecto, 'fechaInicio' | 'fechaFinPlaneada' | 'fechaFinReal'>;

export function erroresFechasProyecto(fechas: FechasProyecto): string[] {
  const errores: string[] = [];
  if (fechas.fechaFinPlaneada && fechas.fechaFinPlaneada < fechas.fechaInicio) {
    errores.push('La fecha de fin planeada no puede ser anterior a la fecha de inicio');
  }
  if (fechas.fechaFinReal && fechas.fechaFinReal < fechas.fechaInicio) {
    errores.push('La fecha de fin real no puede ser anterior a la fecha de inicio');
  }
  return errores;
}
