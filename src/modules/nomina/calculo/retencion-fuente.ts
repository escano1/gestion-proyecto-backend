import { CERO, Decimal, redondearMil } from '../../../common/utils/dinero.js';
import { DIAS_MES_COMERCIAL } from './periodo.js';

/**
 * Tabla del art. 383 E.T. (mod. Ley 2277 de 2022) en UVT: sobre el exceso del umbral
 * se aplica la tarifa marginal y se suman las UVT fijas del tramo. Mayor umbral primero.
 */
const TABLA_RETENCION: { desdeUvt: number; tarifa: Decimal; uvtFijas: number }[] = [
  { desdeUvt: 2300, tarifa: new Decimal('0.39'), uvtFijas: 770 },
  { desdeUvt: 945, tarifa: new Decimal('0.37'), uvtFijas: 268 },
  { desdeUvt: 640, tarifa: new Decimal('0.35'), uvtFijas: 162 },
  { desdeUvt: 360, tarifa: new Decimal('0.33'), uvtFijas: 69 },
  { desdeUvt: 150, tarifa: new Decimal('0.28'), uvtFijas: 10 },
  { desdeUvt: 95, tarifa: new Decimal('0.19'), uvtFijas: 0 },
];

const PORCENTAJE_RENTA_EXENTA = new Decimal('0.25');
// Art. 206 num. 10 E.T. (mod. Ley 2277 de 2022): renta exenta laboral limitada a 790 UVT anuales.
const LIMITE_RENTA_EXENTA_UVT_MES = new Decimal(790).div(12);
// Art. 336 num. 3 E.T. (mod. Ley 2277 de 2022): deducciones y rentas exentas ≤ 40 % y ≤ 1.340 UVT anuales.
const PORCENTAJE_LIMITE_DEDUCCIONES = new Decimal('0.40');
const LIMITE_DEDUCCIONES_UVT_MES = new Decimal(1340).div(12);

/** Retención mensual en UVT para una base gravable mensual en UVT. */
export function retencionEnUvt(baseUvt: Decimal): Decimal {
  const tramo = TABLA_RETENCION.find((t) => baseUvt.gt(t.desdeUvt));
  return tramo ? baseUvt.minus(tramo.desdeUvt).times(tramo.tarifa).plus(tramo.uvtFijas) : CERO;
}

export interface EntradaRetencion {
  /** Total devengado del periodo (pagos laborales, incluido el auxilio de transporte). */
  totalDevengado: Decimal;
  /** Salud + pensión + FSP del periodo (ingresos no constitutivos de renta). */
  aportesObligatorios: Decimal;
  /** Días con los que se mensualiza el periodo. */
  diasBase: number;
  uvt: Decimal;
}

export interface DetalleRetencion {
  factorMensual: Decimal;
  ingresoMensual: Decimal;
  ingresosNoConstitutivos: Decimal;
  subtotal: Decimal;
  rentaExenta: Decimal;
  deduccionesYRentasExentas: Decimal;
  baseGravable: Decimal;
  baseUvt: Decimal;
  retencionUvt: Decimal;
  /** Retención del periodo, redondeada al múltiplo de mil. */
  valor: Decimal;
}

/** Procedimiento 1 (art. 385 E.T.) mensualizando el periodo con f = 30 / diasBase. */
export function calcularRetencionFuente(entrada: EntradaRetencion): DetalleRetencion {
  const { totalDevengado, aportesObligatorios, diasBase, uvt } = entrada;
  const factorMensual = new Decimal(DIAS_MES_COMERCIAL).div(diasBase > 0 ? diasBase : DIAS_MES_COMERCIAL);
  const ingresoMensual = totalDevengado.times(factorMensual);
  const ingresosNoConstitutivos = aportesObligatorios.times(factorMensual);
  const subtotal = Decimal.max(CERO, ingresoMensual.minus(ingresosNoConstitutivos));
  const rentaExenta = Decimal.min(
    subtotal.times(PORCENTAJE_RENTA_EXENTA),
    LIMITE_RENTA_EXENTA_UVT_MES.times(uvt),
  );
  const deduccionesYRentasExentas = Decimal.min(
    rentaExenta,
    subtotal.times(PORCENTAJE_LIMITE_DEDUCCIONES),
    LIMITE_DEDUCCIONES_UVT_MES.times(uvt),
  );
  const baseGravable = subtotal.minus(deduccionesYRentasExentas);
  const baseUvt = baseGravable.div(uvt);
  const retencionUvt = retencionEnUvt(baseUvt);
  const valor = redondearMil(retencionUvt.times(uvt).div(factorMensual));
  return {
    factorMensual,
    ingresoMensual,
    ingresosNoConstitutivos,
    subtotal,
    rentaExenta,
    deduccionesYRentasExentas,
    baseGravable,
    baseUvt,
    retencionUvt,
    valor,
  };
}
