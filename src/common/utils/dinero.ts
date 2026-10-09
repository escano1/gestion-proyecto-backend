import DecimalJs from 'decimal.js';
import type { Decimal as ClaseDecimal } from 'decimal.js';

// decimal.js declara tipos CommonJS, pero su build ESM exporta la clase como default.
export const Decimal = DecimalJs as unknown as typeof ClaseDecimal;
export type Decimal = ClaseDecimal;
export type ValorDecimal = ClaseDecimal.Value;

export const CERO = new Decimal(0);

export const dec = (valor: ValorDecimal | null | undefined): Decimal =>
  new Decimal(valor ?? 0);

/** Redondea al peso más cercano (mitad hacia arriba). */
export const redondearPesos = (valor: Decimal): Decimal =>
  valor.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

/** Redondea al múltiplo de mil más cercano (regla DIAN para retención en la fuente). */
export const redondearMil = (valor: Decimal): Decimal =>
  valor.div(1000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(1000);

export const redondear2 = (valor: Decimal): Decimal =>
  valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const sumar = (valores: Decimal[]): Decimal =>
  valores.reduce((acc, v) => acc.plus(v), CERO);
