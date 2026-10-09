import { Decimal } from '../../common/utils/dinero.js';
import type { ParametrosVigentes } from '../parametros/resolutor-parametros.js';
import { TipoSalario } from './trabajador.entity.js';

export interface DatosSalariales {
  tipoSalario: TipoSalario;
  salarioBase: number;
  /** null = jornada completa (máxima legal vigente). */
  horasSemanales: number | null;
}

/** Horas mensuales = horas semanales / 6 días × 30 días (48 h → 240, 42 h → 210). */
export function horasMensuales(horasSemanales: Decimal): Decimal {
  return horasSemanales.times(5);
}

function horasSemanalesEfectivas(t: DatosSalariales, p: ParametrosVigentes): Decimal {
  return t.horasSemanales ? new Decimal(t.horasSemanales) : p.jornadaMaximaSemanal;
}

/** Valor de la hora ordinaria según el tipo de salario y la jornada vigente en la fecha. */
export function valorHora(t: DatosSalariales, p: ParametrosVigentes): Decimal {
  if (t.tipoSalario === TipoSalario.POR_HORA) return new Decimal(t.salarioBase);
  return new Decimal(t.salarioBase).div(horasMensuales(horasSemanalesEfectivas(t, p)));
}

/** Salario mensual equivalente (para el tope de 2 SMMLV del auxilio de transporte). */
export function salarioMensualEquivalente(t: DatosSalariales, p: ParametrosVigentes): Decimal {
  if (t.tipoSalario === TipoSalario.MENSUAL) return new Decimal(t.salarioBase);
  return new Decimal(t.salarioBase).times(horasMensuales(horasSemanalesEfectivas(t, p)));
}
