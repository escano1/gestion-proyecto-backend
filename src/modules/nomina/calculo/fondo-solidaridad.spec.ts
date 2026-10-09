import { describe, expect, it } from 'vitest';
import { Decimal } from '../../../common/utils/dinero.js';
import { calcularFsp, porcentajeFsp } from './fondo-solidaridad.js';

const SMMLV_2026 = new Decimal(1_750_905);

describe('porcentajeFsp — Ley 797 de 2003', () => {
  it.each([
    ['0', '0'],
    ['3.9999', '0'],
    ['4', '0.01'],
    ['15.9999', '0.01'],
    ['16', '0.012'],
    ['16.9999', '0.012'],
    ['17', '0.014'],
    ['18', '0.016'],
    ['19', '0.018'],
    ['19.9999', '0.018'],
    ['20', '0.02'],
    ['25', '0.02'],
  ])('%s SMMLV → %s', (smmlvs, esperado) => {
    expect(porcentajeFsp(new Decimal(smmlvs)).toString()).toBe(new Decimal(esperado).toString());
  });
});

describe('calcularFsp', () => {
  it('caso B: 12.000.000 mensuales (6,85 SMMLV) ⇒ 1 % = 120.000', () => {
    const r = calcularFsp({ ibc: new Decimal(12_000_000), diasBase: 30, smmlv: SMMLV_2026 });
    expect(r.porcentaje.toNumber()).toBe(0.01);
    expect(r.valor.toNumber()).toBe(120_000);
  });

  it('mensualiza el IBC de una quincena antes de ubicar el tramo', () => {
    // 3.501.810 en 15 días = 7.003.620 mensuales = 4 SMMLV exactos.
    const enUmbral = calcularFsp({ ibc: new Decimal(3_501_810), diasBase: 15, smmlv: SMMLV_2026 });
    const bajoUmbral = calcularFsp({ ibc: new Decimal(3_501_809), diasBase: 15, smmlv: SMMLV_2026 });
    expect(enUmbral.ibcMensual.toNumber()).toBe(7_003_620);
    expect(enUmbral.valor.toNumber()).toBe(35_018);
    expect(bajoUmbral.valor.toNumber()).toBe(0);
  });

  it.each([
    [16, 0.012],
    [17, 0.014],
    [18, 0.016],
    [19, 0.018],
    [20, 0.02],
  ])('IBC de %i SMMLV ⇒ %s', (smmlvs, porcentaje) => {
    const ibc = SMMLV_2026.times(smmlvs);
    const r = calcularFsp({ ibc, diasBase: 30, smmlv: SMMLV_2026 });
    expect(r.porcentaje.toNumber()).toBe(porcentaje);
    expect(r.valor.toNumber()).toBe(ibc.times(porcentaje).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber());
  });

  it('IBC en cero o sin días no genera aporte', () => {
    expect(calcularFsp({ ibc: new Decimal(0), diasBase: 15, smmlv: SMMLV_2026 }).valor.toNumber()).toBe(0);
    expect(calcularFsp({ ibc: new Decimal(9_000_000), diasBase: 0, smmlv: SMMLV_2026 }).valor.toNumber()).toBe(0);
  });
});
