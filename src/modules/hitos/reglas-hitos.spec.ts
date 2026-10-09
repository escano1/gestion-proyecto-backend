import { BadRequestException } from '@nestjs/common';
import { EstadoHito } from './hito-proyecto.entity.js';
import {
  aplicarAvance,
  derivarEstadoHito,
  sumarPesos,
  validarSumaPesos,
} from './reglas-hitos.js';

const HOY = '2026-10-08';

describe('derivarEstadoHito', () => {
  it.each([
    [0, EstadoHito.PENDIENTE],
    [0.01, EstadoHito.EN_PROGRESO],
    [50, EstadoHito.EN_PROGRESO],
    [99.99, EstadoHito.EN_PROGRESO],
    [100, EstadoHito.COMPLETADO],
  ])('avance %d → %s', (avance, estado) => {
    expect(derivarEstadoHito(avance)).toBe(estado);
  });
});

describe('aplicarAvance', () => {
  it('al completar sin fecha real asigna hoy', () => {
    expect(aplicarAvance(100, null, HOY)).toEqual({
      estado: EstadoHito.COMPLETADO,
      fechaReal: HOY,
    });
  });

  it('al completar conserva la fecha real indicada', () => {
    expect(aplicarAvance(100, '2026-09-30', HOY)).toEqual({
      estado: EstadoHito.COMPLETADO,
      fechaReal: '2026-09-30',
    });
  });

  it('sin completar no inventa fecha real', () => {
    expect(aplicarAvance(40, null, HOY)).toEqual({
      estado: EstadoHito.EN_PROGRESO,
      fechaReal: null,
    });
    expect(aplicarAvance(0, null, HOY)).toEqual({
      estado: EstadoHito.PENDIENTE,
      fechaReal: null,
    });
  });
});

describe('sumarPesos', () => {
  it('evita errores de coma flotante', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumarPesos([0.1, 0.2])).toBe(0.3);
    expect(sumarPesos([33.33, 33.33, 33.34])).toBe(100);
  });

  it('suma vacía es cero', () => {
    expect(sumarPesos([])).toBe(0);
  });
});

describe('validarSumaPesos', () => {
  it('acepta hasta 100 exacto', () => {
    expect(() => validarSumaPesos([33.33, 33.33, 33.34])).not.toThrow();
    expect(() => validarSumaPesos([100])).not.toThrow();
    expect(() => validarSumaPesos([20, 30])).not.toThrow();
  });

  it('rechaza si supera 100', () => {
    expect(() => validarSumaPesos([50, 50.01])).toThrow(BadRequestException);
    expect(() => validarSumaPesos([60, 41])).toThrow(
      'La suma de pesos de los hitos no puede superar 100',
    );
  });
});
