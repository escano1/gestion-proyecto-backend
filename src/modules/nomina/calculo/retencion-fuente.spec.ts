import { describe, expect, it } from 'vitest';
import { CERO, Decimal } from '../../../common/utils/dinero.js';
import { calcularRetencionFuente, retencionEnUvt } from './retencion-fuente.js';

const UVT_2026 = new Decimal(52374);

describe('retencionEnUvt — tabla del art. 383 E.T.', () => {
  it.each([
    ['0', '0'],
    ['95', '0'],
    ['95.01', '0.0019'],
    ['100', '0.95'],
    ['150', '10.45'],
    ['150.01', '10.0028'],
    ['200', '24'],
    ['360', '68.8'],
    ['500', '115.2'],
    ['640', '161.4'],
    ['800', '218'],
    ['945', '268.75'],
    ['1000', '288.35'],
    ['2300', '769.35'],
    ['3000', '1043'],
  ])('base %s UVT → %s UVT', (base, esperado) => {
    expect(retencionEnUvt(new Decimal(base)).toString()).toBe(new Decimal(esperado).toString());
  });
});

describe('calcularRetencionFuente — procedimiento 1', () => {
  it('caso B: 12.000.000 mensuales con aportes de 1.080.000 ⇒ 617.000', () => {
    const r = calcularRetencionFuente({
      totalDevengado: new Decimal(12_000_000),
      aportesObligatorios: new Decimal(1_080_000),
      diasBase: 30,
      uvt: UVT_2026,
    });
    expect(r.subtotal.toNumber()).toBe(10_920_000);
    expect(r.rentaExenta.toNumber()).toBe(2_730_000);
    expect(r.deduccionesYRentasExentas.toNumber()).toBe(2_730_000);
    expect(r.baseGravable.toNumber()).toBe(8_190_000);
    expect(r.baseUvt.toDecimalPlaces(4).toNumber()).toBe(156.3753);
    expect(r.valor.toNumber()).toBe(617_000);
  });

  it('la renta exenta del 25 % se limita a 790/12 UVT mensuales', () => {
    const r = calcularRetencionFuente({
      totalDevengado: new Decimal(20_000_000),
      aportesObligatorios: CERO,
      diasBase: 30,
      uvt: UVT_2026,
    });
    // 790 / 12 × 52.374 = 3.447.955.
    expect(r.rentaExenta.toNumber()).toBe(3_447_955);
    expect(r.baseGravable.toNumber()).toBe(16_552_045);
    // (16.552.045 − 150 UVT) × 28 % + 10 UVT = 2.958.604,6 → 2.959.000.
    expect(r.valor.toNumber()).toBe(2_959_000);
  });

  it('mensualiza una quincena (f = 2) y devuelve la retención del periodo', () => {
    const quincena = calcularRetencionFuente({
      totalDevengado: new Decimal(6_000_000),
      aportesObligatorios: new Decimal(540_000),
      diasBase: 15,
      uvt: UVT_2026,
    });
    const mes = calcularRetencionFuente({
      totalDevengado: new Decimal(12_000_000),
      aportesObligatorios: new Decimal(1_080_000),
      diasBase: 30,
      uvt: UVT_2026,
    });
    expect(quincena.factorMensual.toNumber()).toBe(2);
    expect(quincena.baseGravable.toNumber()).toBe(mes.baseGravable.toNumber());
    // 617.232 / 2 = 308.616 → 309.000.
    expect(quincena.valor.toNumber()).toBe(309_000);
  });

  it('base bajo 95 UVT no tiene retención; subtotal nunca es negativo', () => {
    const r = calcularRetencionFuente({
      totalDevengado: new Decimal(100_000),
      aportesObligatorios: new Decimal(500_000),
      diasBase: 15,
      uvt: UVT_2026,
    });
    expect(r.subtotal.toNumber()).toBe(0);
    expect(r.valor.toNumber()).toBe(0);
  });

  it.each([
    // [ingreso mensual sin aportes, retención esperada].
    [6_000_000, 0], // base 4.500.000 = 85,9 UVT
    [8_000_000, 195_000], // base 6.000.000 = 114,6 UVT → 19 %
    [30_000_000, 6_154_000], // renta exenta topada; base 26.552.045 = 507,0 UVT → 33 %
    [45_000_000, 11_296_000], // base 41.552.045 = 793,4 UVT → 35 %
    [60_000_000, 16_648_000], // base 56.552.045 = 1.079,8 UVT → 37 %
    [150_000_000, 50_504_000], // base 146.552.045 = 2.798,2 UVT → 39 %
  ])('ingreso %i ⇒ retención %i', (ingreso, esperado) => {
    const r = calcularRetencionFuente({
      totalDevengado: new Decimal(ingreso),
      aportesObligatorios: CERO,
      diasBase: 30,
      uvt: UVT_2026,
    });
    expect(r.valor.toNumber()).toBe(esperado);
  });
});
