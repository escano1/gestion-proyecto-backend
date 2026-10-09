import { Decimal } from '../../common/utils/dinero.js';
import type { ParametrosVigentes } from '../parametros/resolutor-parametros.js';
import { TipoSalario } from '../trabajadores/trabajador.entity.js';

export interface ClasificacionHora {
  esExtra: boolean;
  esNocturna: boolean;
  esDominicalFestiva: boolean;
}

/**
 * Recargo total (fracción) de un tipo de hora.
 * - Extra nocturna (75 %) NO acumula el nocturno (art. 170 C.S.T.).
 * - El dominical/festivo SÍ se suma a nocturno y extras (práctica del Ministerio):
 *   p. ej. con dominical 90 %: extra dominical diurna = 115 %, nocturna = 165 %.
 */
export function recargoTipoHora(t: ClasificacionHora, p: ParametrosVigentes): Decimal {
  const base = t.esExtra
    ? t.esNocturna
      ? p.recargoExtraNocturna
      : p.recargoExtraDiurna
    : t.esNocturna
      ? p.recargoNocturno
      : new Decimal(0);
  return t.esDominicalFestiva ? base.plus(p.recargoDominicalFestivo) : base;
}

/**
 * Factor sobre el valor hora que se paga como devengado adicional.
 * - Horas extra: siempre (1 + recargo), están por fuera de la jornada.
 * - Salario POR_HORA: toda hora se paga (1 + recargo).
 * - Salario MENSUAL dentro de la jornada: la hora base ya está en el salario; solo se paga el recargo.
 */
export function factorPago(
  t: ClasificacionHora,
  tipoSalario: TipoSalario,
  p: ParametrosVigentes,
): Decimal {
  const recargo = recargoTipoHora(t, p);
  return t.esExtra || tipoSalario === TipoSalario.POR_HORA ? recargo.plus(1) : recargo;
}

/** Factor de costo de mano de obra: la hora completa con su recargo. */
export function factorCosto(t: ClasificacionHora, p: ParametrosVigentes): Decimal {
  return recargoTipoHora(t, p).plus(1);
}
