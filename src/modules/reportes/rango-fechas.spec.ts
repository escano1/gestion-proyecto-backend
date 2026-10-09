import { BadRequestException } from '@nestjs/common';
import {
  diasDelRango,
  MAXIMO_DIAS_REPORTE,
  validarRango,
} from './rango-fechas.js';

describe('rango de fechas de reportes', () => {
  it('cuenta los días incluyendo ambos extremos', () => {
    expect(diasDelRango('2026-10-08', '2026-10-08')).toBe(1);
    expect(diasDelRango('2026-01-01', '2026-12-31')).toBe(365);
    expect(diasDelRango('2028-01-01', '2028-12-31')).toBe(366);
  });

  it('rechaza desde posterior a hasta', () => {
    expect(() => validarRango('2026-10-09', '2026-10-08')).toThrow(
      new BadRequestException(
        'La fecha "desde" no puede ser posterior a "hasta"',
      ),
    );
  });

  it('acepta hasta 366 días y rechaza 367', () => {
    expect(() =>
      validarRango('2026-01-01', '2027-01-01', MAXIMO_DIAS_REPORTE),
    ).not.toThrow();
    expect(() =>
      validarRango('2026-01-01', '2027-01-02', MAXIMO_DIAS_REPORTE),
    ).toThrow('El rango de fechas no puede superar 366 días');
  });

  it('sin máximo solo valida el orden', () => {
    expect(() => validarRango('2020-01-01', '2026-12-31')).not.toThrow();
  });
});
