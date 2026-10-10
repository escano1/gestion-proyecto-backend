import { TipoJornada, type Trabajador } from './trabajador.entity.js';
import type { ParametrosVigentes } from '../parametros/resolutor-parametros.js';
import { salarioMensualEquivalente } from './valor-hora.js';

type DatosJornada = Pick<Trabajador, 'tipoJornada' | 'horasSemanales'>;

/** Campos que alteran la liquidación de nómina del trabajador. */
export const CAMPOS_NOMINA = [
  'salarioBase',
  'tipoSalario',
  'tipoJornada',
  'horasSemanales',
  'aplicaAuxilioTransporte',
  'estado',
] as const satisfies readonly (keyof Trabajador)[];

/** En jornada completa las horas semanales no aplican (se usa la jornada legal vigente). */
export function normalizarJornada(datos: DatosJornada): void {
  if (datos.tipoJornada === TipoJornada.COMPLETA) datos.horasSemanales = null;
}

/** Elegibilidad legal del auxilio de transporte: aplica si el salario mensual equivalente ≤ 2 SMMLV. */
export function calcularAuxilioTransporte(
  datos: Pick<Trabajador, 'tipoSalario' | 'salarioBase' | 'horasSemanales'>,
  parametros: ParametrosVigentes,
): boolean {
  return salarioMensualEquivalente(datos, parametros).lte(
    parametros.smmlv.times(2),
  );
}

/** Reglas que cruzan campos; el DTO ya validó tipos y rangos individuales. */
export function erroresTrabajador(datos: DatosJornada): string[] {
  const errores: string[] = [];
  if (datos.tipoJornada === TipoJornada.PARCIAL && datos.horasSemanales == null) {
    errores.push('horasSemanales es obligatorio para la jornada PARCIAL');
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
