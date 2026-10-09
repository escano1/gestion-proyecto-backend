import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  cambioAfectaNomina,
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
  fechaIngreso: '2026-01-15',
  fechaRetiro: null as string | null,
  estado: EstadoTrabajador.ACTIVO,
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

  it('exige fechaRetiro >= fechaIngreso (el mismo día es válido)', () => {
    expect(erroresTrabajador({ ...base, fechaRetiro: '2026-01-14' })).toEqual([
      'La fecha de retiro no puede ser anterior a la fecha de ingreso',
    ]);
    expect(erroresTrabajador({ ...base, fechaRetiro: '2026-01-15' })).toEqual([]);
  });

  it('exige fechaRetiro a un trabajador INACTIVO', () => {
    expect(erroresTrabajador({ ...base, estado: EstadoTrabajador.INACTIVO })).toEqual([
      'Un trabajador INACTIVO debe tener fecha de retiro',
    ]);
    expect(
      erroresTrabajador({
        ...base,
        estado: EstadoTrabajador.INACTIVO,
        fechaRetiro: '2026-06-30',
      }),
    ).toEqual([]);
  });
});

describe('cambioAfectaNomina', () => {
  const laboral = {
    salarioBase: 2_000_000,
    tipoSalario: TipoSalario.MENSUAL,
    tipoJornada: TipoJornada.COMPLETA,
    horasSemanales: null as number | null,
    fechaIngreso: '2026-01-15',
    fechaRetiro: null as string | null,
    aplicaAuxilioTransporte: true,
  };

  it('no marca recálculo si los datos de nómina no cambian', () => {
    expect(cambioAfectaNomina(laboral, { ...laboral })).toBe(false);
  });

  it.each([
    ['salarioBase', 2_100_000],
    ['tipoSalario', TipoSalario.POR_HORA],
    ['tipoJornada', TipoJornada.PARCIAL],
    ['horasSemanales', 24],
    ['fechaIngreso', '2026-02-01'],
    ['fechaRetiro', '2026-12-31'],
    ['aplicaAuxilioTransporte', false],
  ])('marca recálculo si cambia %s', (campo, valor) => {
    expect(cambioAfectaNomina(laboral, { ...laboral, [campo]: valor })).toBe(true);
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
    fechaIngreso: '2026-01-15',
  };
  const propiedadesConError = async <T extends object>(clase: new () => T, datos: object) =>
    (await validate(plainToInstance(clase, datos))).map((e) => e.property);

  it('acepta los obligatorios y recorta textos', async () => {
    const dto = plainToInstance(CrearTrabajadorDto, valido);
    expect(await validate(dto)).toEqual([]);
    expect(dto.nombre).toBe('Pedro Pérez');
    expect(dto.numeroDocumento).toBe('1020304050');
  });

  it('valida salario positivo, horas 1–48 y fechas', async () => {
    expect(
      await propiedadesConError(CrearTrabajadorDto, {
        ...valido,
        salarioBase: 0,
        horasSemanales: 60,
        fechaIngreso: '2026-02-30',
      }),
    ).toEqual(['salarioBase', 'horasSemanales', 'fechaIngreso']);
  });

  it('rechaza null en campos no anulables con valor por defecto', async () => {
    expect(
      await propiedadesConError(CrearTrabajadorDto, { ...valido, tipoJornada: null, estado: null }),
    ).toEqual(['tipoJornada', 'estado']);
  });

  it('en la edición acepta null solo en campos anulables', async () => {
    expect(
      await propiedadesConError(ActualizarTrabajadorDto, {
        fechaRetiro: null,
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
