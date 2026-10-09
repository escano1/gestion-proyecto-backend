import { EstadoTrabajador, TipoJornada, type Trabajador } from './trabajador.entity.js';

type DatosJornada = Pick<Trabajador, 'tipoJornada' | 'horasSemanales'>;
type DatosValidables = DatosJornada &
  Pick<Trabajador, 'fechaIngreso' | 'fechaRetiro' | 'estado'>;

/** Campos que alteran la liquidación de nómina del trabajador. */
export const CAMPOS_NOMINA = [
  'salarioBase',
  'tipoSalario',
  'tipoJornada',
  'horasSemanales',
  'fechaIngreso',
  'fechaRetiro',
  'aplicaAuxilioTransporte',
] as const satisfies readonly (keyof Trabajador)[];

/** En jornada completa las horas semanales no aplican (se usa la jornada legal vigente). */
export function normalizarJornada(datos: DatosJornada): void {
  if (datos.tipoJornada === TipoJornada.COMPLETA) datos.horasSemanales = null;
}

/** Reglas que cruzan campos; el DTO ya validó tipos y rangos individuales. */
export function erroresTrabajador(datos: DatosValidables): string[] {
  const errores: string[] = [];
  if (datos.tipoJornada === TipoJornada.PARCIAL && datos.horasSemanales == null) {
    errores.push('horasSemanales es obligatorio para la jornada PARCIAL');
  }
  if (datos.fechaRetiro && datos.fechaRetiro < datos.fechaIngreso) {
    errores.push('La fecha de retiro no puede ser anterior a la fecha de ingreso');
  }
  if (datos.estado === EstadoTrabajador.INACTIVO && !datos.fechaRetiro) {
    errores.push('Un trabajador INACTIVO debe tener fecha de retiro');
  }
  return errores;
}

export function cambioAfectaNomina(
  antes: Pick<Trabajador, (typeof CAMPOS_NOMINA)[number]>,
  despues: Pick<Trabajador, (typeof CAMPOS_NOMINA)[number]>,
): boolean {
  return CAMPOS_NOMINA.some((campo) => antes[campo] !== despues[campo]);
}

/** Patrón ILIKE que busca el texto literal (escapa comodines). */
export function patronBusqueda(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
}
