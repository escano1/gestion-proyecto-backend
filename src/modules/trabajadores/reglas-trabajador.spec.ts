import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Fecha } from '../../common/utils/fechas.js';
import { CodigoParametro } from '../parametros/parametro-legal.entity.js';
import {
  ResolutorParametros,
  type FilaParametro,
} from '../parametros/resolutor-parametros.js';
import {
  cambioAfectaNomina,
  calcularAuxilioTransporte,
  erroresTrabajador,
  normalizarJornada,
  patronBusqueda,
} from './reglas-trabajador.js';
import {
  EstadoTrabajador,
  TipoContrato,
  TipoDocumento,
  TipoJornada,
  TipoSalario,
} from './trabajador.entity.js';
import { ActualizarTrabajadorDto, CrearTrabajadorDto } from './trabajadores.dto.js';

const base = {
  tipoJornada: TipoJornada.COMPLETA,
  horasSemanales: null as number | null,
};

describe('normalizarJornada', () => {
  it('limpia horasSemanales en jornada completa', () => {
    const datos = { tipoJornada: TipoJornada.COMPLETA, horasSemanales: 30 as number | null };
    normalizarJornada(datos);
    expect(datos.horasSemanales).toBeNull();
  });

  it('conserva horasSemanales en jornada parcial', () => {
    const datos = { tipoJornada: TipoJornada.PARCIAL, horasSemanales: 24 as number | null };
    normalizarJornada(datos);
    expect(datos.horasSemanales).toBe(24);
  });
});

describe('erroresTrabajador', () => {
  it('acepta un trabajador activo de jornada completa', () => {
    expect(erroresTrabajador(base)).toEqual([]);
  });

  it('exige horasSemanales en jornada parcial', () => {
    expect(erroresTrabajador({ ...base, tipoJornada: TipoJornada.PARCIAL })).toEqual([
      'horasSemanales es obligatorio para la jornada PARCIAL',
    ]);
    expect(
      erroresTrabajador({ ...base, tipoJornada: TipoJornada.PARCIAL, horasSemanales: 24 }),
    ).toEqual([]);
  });

});

describe('cambioAfectaNomina', () => {
  const laboral = {
    salarioBase: 2_000_000,
    tipoSalario: TipoSalario.MENSUAL,
    tipoJornada: TipoJornada.COMPLETA,
    horasSemanales: null as number | null,
    aplicaAuxilioTransporte: true,
    estado: EstadoTrabajador.ACTIVO,
  };

  it('no marca recálculo si los datos de nómina no cambian', () => {
    expect(cambioAfectaNomina(laboral, { ...laboral })).toBe(false);
  });

  it.each([
    ['salarioBase', 2_100_000],
    ['tipoSalario', TipoSalario.POR_HORA],
    ['tipoJornada', TipoJornada.PARCIAL],
    ['horasSemanales', 24],
    ['aplicaAuxilioTransporte', false],
    ['estado', EstadoTrabajador.INACTIVO],
  ])('marca recálculo si cambia %s', (campo, valor) => {
    expect(cambioAfectaNomina(laboral, { ...laboral, [campo]: valor })).toBe(true);
  });
});
describe('calcularAuxilioTransporte', () => {
  // Vigencias sembradas en la base de datos (migración DatosIniciales).
  const VIGENCIAS: [CodigoParametro, number, Fecha][] = [
    [CodigoParametro.SMMLV, 1_750_905, '2026-01-01'],
    [CodigoParametro.AUXILIO_TRANSPORTE, 249_095, '2026-01-01'],
    [CodigoParametro.UVT, 52_374, '2026-01-01'],
    [CodigoParametro.JORNADA_MAXIMA_SEMANAL, 42, '2026-07-15'],
    [CodigoParametro.RECARGO_NOCTURNO, 0.35, '2024-01-01'],
    [CodigoParametro.RECARGO_EXTRA_DIURNA, 0.25, '2024-01-01'],
    [CodigoParametro.RECARGO_EXTRA_NOCTURNA, 0.75, '2024-01-01'],
    [CodigoParametro.RECARGO_DOMINICAL_FESTIVO, 0.9, '2026-07-01'],
    [CodigoParametro.APORTE_SALUD_EMPLEADO, 0.04, '2024-01-01'],
    [CodigoParametro.APORTE_PENSION_EMPLEADO, 0.04, '2024-01-01'],
    [CodigoParametro.LIMITE_HORAS_EXTRA_DIA, 2, '2024-01-01'],
    [CodigoParametro.LIMITE_HORAS_EXTRA_SEMANA, 12, '2024-01-01'],
  ];
  const parametros = new ResolutorParametros(
    VIGENCIAS.map(([codigo, valor, vigenteDesde]): FilaParametro => ({ codigo, valor, vigenteDesde })),
  ).en('2026-10-09');

  it('aplica si el salario mensual es menor o igual a 2 SMMLV', () => {
    expect(
      calcularAuxilioTransporte({ tipoSalario: TipoSalario.MENSUAL, salarioBase: 2_100_000, horasSemanales: null }, parametros),
    ).toBe(true);
    expect(
      calcularAuxilioTransporte({ tipoSalario: TipoSalario.MENSUAL, salarioBase: 3_501_810, horasSemanales: null }, parametros),
    ).toBe(true);
  });

  it('no aplica si el salario mensual supera 2 SMMLV', () => {
    expect(
      calcularAuxilioTransporte({ tipoSalario: TipoSalario.MENSUAL, salarioBase: 3_501_811, horasSemanales: null }, parametros),
    ).toBe(false);
  });

  it('convierte el valor por hora a su equivalente mensual (jornada completa vigente)', () => {
    // 12.000 × 210 h = 2.520.000 ≤ 2 SMMLV
    expect(
      calcularAuxilioTransporte({ tipoSalario: TipoSalario.POR_HORA, salarioBase: 12_000, horasSemanales: null }, parametros),
    ).toBe(true);
    // 20.000 × 210 h = 4.200.000 > 2 SMMLV
    expect(
      calcularAuxilioTransporte({ tipoSalario: TipoSalario.POR_HORA, salarioBase: 20_000, horasSemanales: null }, parametros),
    ).toBe(false);
  });
});
describe('patronBusqueda', () => {
  it('envuelve con comodines y escapa los del texto', () => {
    expect(patronBusqueda('ana')).toBe('%ana%');
    expect(patronBusqueda('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});

describe('DTOs de trabajador', () => {
  const valido = {
    nombre: ' Pedro Pérez ',
    tipoDocumento: TipoDocumento.CC,
    numeroDocumento: ' 1020304050 ',
    cargo: 'Electricista',
    tipoSalario: TipoSalario.MENSUAL,
    salarioBase: 1_750_905,
    tipoContrato: TipoContrato.INDEFINIDO,
  };
  const propiedadesConError = async <T extends object>(clase: new () => T, datos: object) =>
    (await validate(plainToInstance(clase, datos))).map((e) => e.property);

  it('acepta los obligatorios y recorta textos', async () => {
    const dto = plainToInstance(CrearTrabajadorDto, valido);
    expect(await validate(dto)).toEqual([]);
    expect(dto.nombre).toBe('Pedro Pérez');
    expect(dto.numeroDocumento).toBe('1020304050');
  });

  it('valida salario positivo y horas 1–48', async () => {
    expect(
      await propiedadesConError(CrearTrabajadorDto, {
        ...valido,
        salarioBase: 0,
        horasSemanales: 60,
      }),
    ).toEqual(['salarioBase', 'horasSemanales']);
  });

  it('rechaza null en campos no anulables con valor por defecto', async () => {
    expect(
      await propiedadesConError(CrearTrabajadorDto, { ...valido, tipoJornada: null, estado: null }),
    ).toEqual(['tipoJornada', 'estado']);
  });

  it('en la edición acepta null solo en campos anulables', async () => {
    expect(
      await propiedadesConError(ActualizarTrabajadorDto, {
        email: null,
        horasSemanales: null,
      }),
    ).toEqual([]);
    expect(
      await propiedadesConError(ActualizarTrabajadorDto, { nombre: null, salarioBase: null }),
    ).toEqual(['nombre', 'salarioBase']);
  });

  it('convierte textos opcionales vacíos en null', async () => {
    const dto = plainToInstance(ActualizarTrabajadorDto, { email: '  ', eps: ' Sura ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.email).toBeNull();
    expect(dto.eps).toBe('Sura');
  });
});
