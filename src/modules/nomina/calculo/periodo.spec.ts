import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { TipoPeriodo } from '../nomina.entity.js';
import {
  construirPeriodo,
  describirPeriodo,
  diasComerciales,
  rangoEfectivo,
  sufijoPeriodo,
} from './periodo.js';

describe('construirPeriodo', () => {
  it('quincena 1: días 1 a 15', () => {
    expect(construirPeriodo(TipoPeriodo.QUINCENAL, 2026, 10, 1)).toEqual({
      tipoPeriodo: TipoPeriodo.QUINCENAL,
      anio: 2026,
      mes: 10,
      quincena: 1,
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-15',
      diasNominales: 15,
    });
  });

  it('quincena 2: del 16 al último día del mes (febrero bisiesto incluido)', () => {
    expect(construirPeriodo(TipoPeriodo.QUINCENAL, 2026, 10, 2)).toMatchObject({
      fechaInicio: '2026-10-16',
      fechaFin: '2026-10-31',
      diasNominales: 15,
    });
    expect(construirPeriodo(TipoPeriodo.QUINCENAL, 2028, 2, 2).fechaFin).toBe('2028-02-29');
  });

  it('mensual: mes completo con 30 días nominales', () => {
    expect(construirPeriodo(TipoPeriodo.MENSUAL, 2026, 2)).toMatchObject({
      quincena: null,
      fechaInicio: '2026-02-01',
      fechaFin: '2026-02-28',
      diasNominales: 30,
    });
    expect(construirPeriodo(TipoPeriodo.MENSUAL, 2026, 2, null).quincena).toBeNull();
  });

  it.each([
    [TipoPeriodo.QUINCENAL, 2026, 10, undefined, 'obligatoria'],
    [TipoPeriodo.QUINCENAL, 2026, 10, 3, 'obligatoria'],
    [TipoPeriodo.MENSUAL, 2026, 10, 1, 'no aplica'],
    [TipoPeriodo.MENSUAL, 2026, 13, undefined, 'mes'],
    [TipoPeriodo.MENSUAL, 2026, 0, undefined, 'mes'],
    [TipoPeriodo.MENSUAL, 2023, 12, undefined, 'año'],
    [TipoPeriodo.MENSUAL, 2101, 1, undefined, 'año'],
  ])('rechaza %s %i-%i quincena %s con 400', (tipo, anio, mes, quincena, mensaje) => {
    expect(() => construirPeriodo(tipo, anio, mes, quincena)).toThrow(BadRequestException);
    expect(() => construirPeriodo(tipo, anio, mes, quincena)).toThrow(mensaje);
  });
});

describe('diasComerciales', () => {
  it.each([
    ['2026-10-01', '2026-10-15', 15],
    ['2026-10-16', '2026-10-31', 15],
    ['2026-10-01', '2026-10-31', 30],
    ['2026-02-16', '2026-02-28', 15],
    ['2026-02-01', '2026-02-28', 30],
    ['2028-02-16', '2028-02-29', 15],
    ['2026-01-31', '2026-01-31', 1],
    ['2026-01-30', '2026-01-31', 1],
    ['2026-01-16', '2026-01-30', 15],
    ['2026-02-28', '2026-02-28', 3],
    ['2026-10-20', '2026-10-31', 11],
    ['2026-10-01', '2026-10-10', 10],
    ['2026-10-10', '2026-10-09', 0],
  ])('%s a %s = %i días', (desde, hasta, dias) => {
    expect(diasComerciales(desde, hasta)).toBe(dias);
  });

  it('exige un rango dentro del mismo mes', () => {
    expect(() => diasComerciales('2026-10-20', '2026-11-05')).toThrow();
  });
});

describe('rangoEfectivo', () => {
  const q2 = { fechaInicio: '2026-10-16', fechaFin: '2026-10-31' };

  it('recorta por ingreso y retiro', () => {
    expect(rangoEfectivo(q2, '2026-10-20', null)).toEqual({ desde: '2026-10-20', hasta: '2026-10-31' });
    expect(rangoEfectivo(q2, '2020-01-01', '2026-10-25')).toEqual({
      desde: '2026-10-16',
      hasta: '2026-10-25',
    });
    expect(rangoEfectivo(q2, '2026-10-31', '2026-10-31')).toEqual({
      desde: '2026-10-31',
      hasta: '2026-10-31',
    });
  });

  it('null si el vínculo no se cruza con el periodo', () => {
    expect(rangoEfectivo(q2, '2020-01-01', '2026-10-15')).toBeNull();
    expect(rangoEfectivo(q2, '2026-11-01', null)).toBeNull();
  });
});

describe('nombres del periodo', () => {
  it('sufijo para archivos y descripción legible', () => {
    const q2 = construirPeriodo(TipoPeriodo.QUINCENAL, 2026, 10, 2);
    const mes = construirPeriodo(TipoPeriodo.MENSUAL, 2026, 3);
    expect(sufijoPeriodo(q2)).toBe('2026-10-Q2');
    expect(sufijoPeriodo(mes)).toBe('2026-03');
    expect(describirPeriodo(q2)).toBe('Quincena 2 de octubre de 2026 (2026-10-16 a 2026-10-31)');
    expect(describirPeriodo(mes)).toBe('Marzo de 2026 (2026-03-01 a 2026-03-31)');
  });
});
