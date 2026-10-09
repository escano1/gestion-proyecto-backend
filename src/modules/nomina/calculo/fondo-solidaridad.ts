import { CERO, Decimal, redondearPesos } from '../../../common/utils/dinero.js';
import { DIAS_MES_COMERCIAL } from './periodo.js';

/**
 * Fondo de Solidaridad Pensional (art. 27 Ley 100 de 1993, mod. art. 8 Ley 797 de 2003):
 * 1 % desde 4 SMMLV; desde 16 SMMLV se suma 0,2 % por cada SMMLV adicional, hasta 2 % en 20 o más.
 * Ordenados de mayor a menor umbral.
 */
const TRAMOS_FSP: { desdeSmmlv: number; porcentaje: Decimal }[] = [
  { desdeSmmlv: 20, porcentaje: new Decimal('0.02') },
  { desdeSmmlv: 19, porcentaje: new Decimal('0.018') },
  { desdeSmmlv: 18, porcentaje: new Decimal('0.016') },
  { desdeSmmlv: 17, porcentaje: new Decimal('0.014') },
  { desdeSmmlv: 16, porcentaje: new Decimal('0.012') },
  { desdeSmmlv: 4, porcentaje: new Decimal('0.01') },
];

/** Porcentaje del FSP según el IBC mensual expresado en SMMLV. */
export function porcentajeFsp(ibcMensualEnSmmlv: Decimal): Decimal {
  return TRAMOS_FSP.find((t) => ibcMensualEnSmmlv.gte(t.desdeSmmlv))?.porcentaje ?? CERO;
}

export interface EntradaFsp {
  /** IBC del periodo liquidado. */
  ibc: Decimal;
  /** Días con los que se mensualiza el IBC del periodo. */
  diasBase: number;
  smmlv: Decimal;
}

export interface ResultadoFsp {
  ibcMensual: Decimal;
  porcentaje: Decimal;
  valor: Decimal;
}

export function calcularFsp({ ibc, diasBase, smmlv }: EntradaFsp): ResultadoFsp {
  if (diasBase <= 0 || ibc.lte(0)) {
    return { ibcMensual: CERO, porcentaje: CERO, valor: CERO };
  }
  const ibcMensual = ibc.times(DIAS_MES_COMERCIAL).div(diasBase);
  const porcentaje = porcentajeFsp(ibcMensual.div(smmlv));
  return { ibcMensual, porcentaje, valor: redondearPesos(ibc.times(porcentaje)) };
}
