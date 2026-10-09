import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  contieneFecha,
  esRangoValido,
  rangosSeSolapan,
  type RangoFechas,
  tramosExcluidos,
} from './rangos-fechas.js';
import { aAsignacionRespuesta } from './asignacion-respuesta.js';
import { ActualizarAsignacionDto } from './asignaciones.dto.js';
import type { AsignacionProyecto } from './asignacion-proyecto.entity.js';

const r = (inicio: string, fin: string | null = null): RangoFechas => ({ inicio, fin });

describe('esRangoValido', () => {
  it('acepta fin abierto, igual o posterior al inicio', () => {
    expect(esRangoValido(r('2026-01-01'))).toBe(true);
    expect(esRangoValido(r('2026-01-01', '2026-01-01'))).toBe(true);
    expect(esRangoValido(r('2026-01-01', '2026-02-01'))).toBe(true);
  });

  it('rechaza fin anterior al inicio', () => {
    expect(esRangoValido(r('2026-01-02', '2026-01-01'))).toBe(false);
  });
});

describe('rangosSeSolapan', () => {
  it.each([
    ['cerrados que se cruzan', r('2026-01-01', '2026-01-31'), r('2026-01-15', '2026-02-15')],
    ['que comparten un solo día', r('2026-01-01', '2026-01-31'), r('2026-01-31', '2026-02-15')],
    ['uno contenido en otro', r('2026-01-01', '2026-12-31'), r('2026-03-01', '2026-03-02')],
    ['abierto con posterior', r('2026-01-01'), r('2027-05-01', '2027-05-31')],
    ['dos abiertos', r('2026-01-01'), r('2020-01-01')],
    ['cerrado anterior con abierto que inicia en su fin', r('2026-01-01', '2026-01-31'), r('2026-01-31')],
  ])('detecta %s', (_caso, a, b) => {
    expect(rangosSeSolapan(a, b)).toBe(true);
    expect(rangosSeSolapan(b, a)).toBe(true);
  });

  it.each([
    ['consecutivos', r('2026-01-01', '2026-01-31'), r('2026-02-01', '2026-02-28')],
    ['abierto posterior a uno cerrado', r('2026-01-01', '2026-01-31'), r('2026-02-01')],
  ])('no confunde rangos %s', (_caso, a, b) => {
    expect(rangosSeSolapan(a, b)).toBe(false);
    expect(rangosSeSolapan(b, a)).toBe(false);
  });
});

describe('contieneFecha', () => {
  it('incluye los extremos y trata fin null como infinito', () => {
    expect(contieneFecha(r('2026-01-01', '2026-01-31'), '2026-01-01')).toBe(true);
    expect(contieneFecha(r('2026-01-01', '2026-01-31'), '2026-01-31')).toBe(true);
    expect(contieneFecha(r('2026-01-01', '2026-01-31'), '2026-02-01')).toBe(false);
    expect(contieneFecha(r('2026-01-01'), '2099-12-31')).toBe(true);
    expect(contieneFecha(r('2026-01-01'), '2025-12-31')).toBe(false);
  });
});

describe('tramosExcluidos', () => {
  it('no excluye nada si el nuevo rango cubre al anterior', () => {
    expect(tramosExcluidos(r('2026-02-01', '2026-02-28'), r('2026-01-01'))).toEqual([]);
    expect(tramosExcluidos(r('2026-02-01', '2026-02-28'), r('2026-02-01', '2026-02-28'))).toEqual([]);
  });

  it('excluye el inicio cuando se atrasa la fecha de inicio', () => {
    expect(tramosExcluidos(r('2026-01-01', '2026-01-31'), r('2026-01-10', '2026-01-31'))).toEqual([
      r('2026-01-01', '2026-01-09'),
    ]);
  });

  it('excluye el final cuando se adelanta la fecha de fin', () => {
    expect(tramosExcluidos(r('2026-01-01', '2026-01-31'), r('2026-01-01', '2026-01-20'))).toEqual([
      r('2026-01-21', '2026-01-31'),
    ]);
  });

  it('cerrar una asignación abierta excluye todo lo posterior al nuevo fin', () => {
    expect(tramosExcluidos(r('2026-01-01'), r('2026-01-01', '2026-03-31'))).toEqual([
      r('2026-04-01'),
    ]);
  });

  it('excluye ambos extremos cuando el rango se reduce por los dos lados', () => {
    expect(tramosExcluidos(r('2026-01-01'), r('2026-02-01', '2026-02-28'))).toEqual([
      r('2026-01-01', '2026-01-31'),
      r('2026-03-01'),
    ]);
  });

  it('excluye todo el rango anterior si el nuevo no lo toca', () => {
    expect(tramosExcluidos(r('2026-01-01', '2026-01-31'), r('2026-03-01', '2026-03-31'))).toEqual([
      r('2026-01-01', '2026-01-31'),
    ]);
    expect(tramosExcluidos(r('2026-03-01'), r('2026-01-01', '2026-01-31'))).toEqual([
      r('2026-03-01'),
    ]);
  });
});

describe('aAsignacionRespuesta', () => {
  const asignacion = {
    id: 3,
    trabajadorId: 5,
    proyectoId: 9,
    fechaInicio: '2026-01-01',
    fechaFin: '2026-01-31',
    rolEnProyecto: 'Oficial',
    creadoEn: new Date('2026-01-01T12:00:00Z'),
    trabajador: { id: 5, nombre: 'Pedro', numeroDocumento: '123', cargo: 'Electricista', salarioBase: 1 },
    proyecto: { id: 9, codigo: 'P-01', nombre: 'Subestación', cliente: 'X' },
  } as unknown as AsignacionProyecto;

  it('resume trabajador y proyecto y calcula vigencia con la fecha dada', () => {
    expect(aAsignacionRespuesta(asignacion, '2026-01-31')).toEqual({
      id: 3,
      trabajadorId: 5,
      proyectoId: 9,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      rolEnProyecto: 'Oficial',
      vigente: true,
      trabajador: { id: 5, nombre: 'Pedro', numeroDocumento: '123', cargo: 'Electricista' },
      proyecto: { id: 9, codigo: 'P-01', nombre: 'Subestación' },
      creadoEn: new Date('2026-01-01T12:00:00Z'),
    });
    expect(aAsignacionRespuesta(asignacion, '2026-02-01').vigente).toBe(false);
  });
});

describe('ActualizarAsignacionDto', () => {
  const propiedadesConError = async (datos: object) =>
    (await validate(plainToInstance(ActualizarAsignacionDto, datos))).map((e) => e.property);

  it('permite fechaFin null (asignación abierta) pero no fechaInicio null', async () => {
    expect(await propiedadesConError({ fechaFin: null, rolEnProyecto: null })).toEqual([]);
    expect(await propiedadesConError({ fechaInicio: null })).toEqual(['fechaInicio']);
  });

  it('no admite cambiar trabajador ni proyecto', async () => {
    const errores = await validate(plainToInstance(ActualizarAsignacionDto, { trabajadorId: 2 }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errores.map((e) => e.property)).toEqual(['trabajadorId']);
  });
});
