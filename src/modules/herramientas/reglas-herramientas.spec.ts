import { BadRequestException } from '@nestjs/common';
import { EstadoHerramienta } from './herramienta-proyecto.entity.js';
import {
  completarFechaDevolucion,
  estaVencida,
  validarFechasHerramienta,
} from './reglas-herramientas.js';

const HOY = '2026-10-08';

describe('estaVencida', () => {
  it('asignada con devolución prevista anterior a hoy', () => {
    expect(
      estaVencida(
        { estado: EstadoHerramienta.ASIGNADA, fechaDevolucionPrevista: '2026-10-07' },
        HOY,
      ),
    ).toBe(true);
  });

  it('no vence el mismo día previsto ni después', () => {
    expect(
      estaVencida({ estado: EstadoHerramienta.ASIGNADA, fechaDevolucionPrevista: HOY }, HOY),
    ).toBe(false);
    expect(
      estaVencida(
        { estado: EstadoHerramienta.ASIGNADA, fechaDevolucionPrevista: '2026-12-01' },
        HOY,
      ),
    ).toBe(false);
  });

  it('sin fecha prevista nunca vence', () => {
    expect(
      estaVencida({ estado: EstadoHerramienta.ASIGNADA, fechaDevolucionPrevista: null }, HOY),
    ).toBe(false);
  });

  it.each([EstadoHerramienta.DEVUELTA, EstadoHerramienta.EXTRAVIADA])(
    '%s no se considera vencida',
    (estado) => {
      expect(estaVencida({ estado, fechaDevolucionPrevista: '2026-01-01' }, HOY)).toBe(false);
    },
  );
});

describe('validarFechasHerramienta', () => {
  it('acepta devolución prevista igual o posterior a la asignación, o ausente', () => {
    expect(() => validarFechasHerramienta('2026-10-01', '2026-10-01')).not.toThrow();
    expect(() => validarFechasHerramienta('2026-10-01', '2026-11-01')).not.toThrow();
    expect(() => validarFechasHerramienta('2026-10-01', null)).not.toThrow();
  });

  it('rechaza devolución prevista anterior a la asignación', () => {
    expect(() => validarFechasHerramienta('2026-10-01', '2026-09-30')).toThrow(
      BadRequestException,
    );
  });
});

describe('completarFechaDevolucion', () => {
  it('DEVUELTA sin fecha → hoy', () => {
    expect(completarFechaDevolucion(EstadoHerramienta.DEVUELTA, null, HOY)).toBe(HOY);
  });

  it('respeta la fecha indicada', () => {
    expect(completarFechaDevolucion(EstadoHerramienta.DEVUELTA, '2026-10-01', HOY)).toBe(
      '2026-10-01',
    );
  });

  it('otros estados no asignan fecha', () => {
    expect(completarFechaDevolucion(EstadoHerramienta.ASIGNADA, null, HOY)).toBeNull();
    expect(completarFechaDevolucion(EstadoHerramienta.EXTRAVIADA, null, HOY)).toBeNull();
  });
});
