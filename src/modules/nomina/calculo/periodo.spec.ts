import { BadRequestException } from '@nestjs/common';
import { construirPeriodo, describirPeriodo, periodoDe, sufijoPeriodo } from './periodo.js';

describe('construirPeriodo', () => {
  it('devuelve la semana lunes–domingo que contiene la fecha', () => {
    const esperado = {
      anio: 2026,
      fechaInicio: '2026-10-05',
      fechaFin: '2026-10-11',
      diasNominales: 7,
    };
    expect(construirPeriodo('2026-10-05')).toEqual(esperado);
    expect(construirPeriodo('2026-10-08')).toEqual(esperado);
    expect(construirPeriodo('2026-10-11')).toEqual(esperado);
  });

  it('cruza de mes y de año', () => {
    expect(construirPeriodo('2026-09-30')).toMatchObject({
      fechaInicio: '2026-09-28',
      fechaFin: '2026-10-04',
    });
    expect(construirPeriodo('2026-12-31')).toMatchObject({
      anio: 2026,
      fechaInicio: '2026-12-28',
      fechaFin: '2027-01-03',
    });
  });

  it('el año es el del lunes de la semana', () => {
    expect(construirPeriodo('2027-01-01').anio).toBe(2026);
  });

  it('rechaza fechas inválidas o fuera del rango de años', () => {
    expect(() => construirPeriodo('2026-02-30')).toThrow(BadRequestException);
    expect(() => construirPeriodo('2023-06-05')).toThrow(/El año debe estar entre/);
    expect(() => construirPeriodo('2101-01-04')).toThrow(/El año debe estar entre/);
  });
});

describe('periodoDe', () => {
  it('reconstruye el periodo de una liquidación guardada', () => {
    expect(periodoDe({ fechaInicio: '2026-10-05', fechaFin: '2026-10-11' })).toEqual(
      construirPeriodo('2026-10-05'),
    );
  });
});

describe('descripción del periodo', () => {
  const periodo = { fechaInicio: '2026-10-05', fechaFin: '2026-10-11' };

  it('describe la semana', () => {
    expect(describirPeriodo(periodo)).toBe('Semana del 2026-10-05 al 2026-10-11');
  });

  it('arma el sufijo de los nombres de archivo', () => {
    expect(sufijoPeriodo(periodo)).toBe('2026-10-05_2026-10-11');
  });
});
