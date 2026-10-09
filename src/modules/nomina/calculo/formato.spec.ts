import { describe, expect, it } from 'vitest';
import {
  formatearFechaHoraColombia,
  formatearNumero,
  formatearPesos,
  formatearPorcentaje,
} from './formato.js';

describe('formato colombiano', () => {
  it.each([
    [1_253_048, '$ 1.253.048'],
    [0, '$ 0'],
    [999, '$ 999'],
    [9_545.45, '$ 9.545,45'],
    [70_000.5, '$ 70.000,50'],
    [-580_000, '-$ 580.000'],
    ['123456789.004', '$ 123.456.789'],
  ])('pesos %s → %s', (valor, esperado) => {
    expect(formatearPesos(valor)).toBe(esperado);
  });

  it('números y porcentajes', () => {
    expect(formatearNumero(1234.5)).toBe('1.234,5');
    expect(formatearNumero(40)).toBe('40');
    expect(formatearPorcentaje(0.35)).toBe('35 %');
    expect(formatearPorcentaje(2.15)).toBe('215 %');
    expect(formatearPorcentaje(0.012)).toBe('1,2 %');
  });

  it('fecha y hora en la zona de Colombia (UTC−5)', () => {
    expect(formatearFechaHoraColombia(new Date('2026-10-09T04:40:00Z'))).toBe('2026-10-08 23:40');
  });
});
