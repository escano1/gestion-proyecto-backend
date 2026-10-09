import { CodigoParametro } from '../parametros/parametro-legal.entity.js';
import {
  type FilaParametro,
  ParametroNoVigenteError,
  ResolutorParametros,
} from '../parametros/resolutor-parametros.js';
import {
  aHorasPorDia,
  type AlertaHoras,
  alertasDeCambios,
  alertasEnRango,
  evaluarAlertas,
  type HorasDiaTrabajador,
  semanasQueCubren,
} from './alertas-horas.js';

const FILAS_PARAMETROS: FilaParametro[] = [
  { codigo: CodigoParametro.SMMLV, valor: 1423500, vigenteDesde: '2025-01-01' },
  { codigo: CodigoParametro.SMMLV, valor: 1750905, vigenteDesde: '2026-01-01' },
  {
    codigo: CodigoParametro.AUXILIO_TRANSPORTE,
    valor: 200000,
    vigenteDesde: '2025-01-01',
  },
  {
    codigo: CodigoParametro.AUXILIO_TRANSPORTE,
    valor: 249095,
    vigenteDesde: '2026-01-01',
  },
  { codigo: CodigoParametro.UVT, valor: 49799, vigenteDesde: '2025-01-01' },
  { codigo: CodigoParametro.UVT, valor: 52374, vigenteDesde: '2026-01-01' },
  {
    codigo: CodigoParametro.JORNADA_MAXIMA_SEMANAL,
    valor: 46,
    vigenteDesde: '2024-07-15',
  },
  {
    codigo: CodigoParametro.JORNADA_MAXIMA_SEMANAL,
    valor: 44,
    vigenteDesde: '2025-07-15',
  },
  {
    codigo: CodigoParametro.JORNADA_MAXIMA_SEMANAL,
    valor: 42,
    vigenteDesde: '2026-07-15',
  },
  {
    codigo: CodigoParametro.RECARGO_NOCTURNO,
    valor: 0.35,
    vigenteDesde: '2024-01-01',
  },
  {
    codigo: CodigoParametro.RECARGO_EXTRA_DIURNA,
    valor: 0.25,
    vigenteDesde: '2024-01-01',
  },
  {
    codigo: CodigoParametro.RECARGO_EXTRA_NOCTURNA,
    valor: 0.75,
    vigenteDesde: '2024-01-01',
  },
  {
    codigo: CodigoParametro.RECARGO_DOMINICAL_FESTIVO,
    valor: 0.8,
    vigenteDesde: '2025-07-01',
  },
  {
    codigo: CodigoParametro.RECARGO_DOMINICAL_FESTIVO,
    valor: 0.9,
    vigenteDesde: '2026-07-01',
  },
  {
    codigo: CodigoParametro.APORTE_SALUD_EMPLEADO,
    valor: 0.04,
    vigenteDesde: '2024-01-01',
  },
  {
    codigo: CodigoParametro.APORTE_PENSION_EMPLEADO,
    valor: 0.04,
    vigenteDesde: '2024-01-01',
  },
  {
    codigo: CodigoParametro.LIMITE_HORAS_EXTRA_DIA,
    valor: 2,
    vigenteDesde: '2024-01-01',
  },
  {
    codigo: CodigoParametro.LIMITE_HORAS_EXTRA_SEMANA,
    valor: 12,
    vigenteDesde: '2024-01-01',
  },
];

const resolutor = new ResolutorParametros(FILAS_PARAMETROS);

const JUAN = { trabajadorId: 1, nombre: 'Juan Pérez' };
const ANA = { trabajadorId: 2, nombre: 'Ana Gómez' };

const dia = (
  trabajador: { trabajadorId: number; nombre: string },
  fecha: string,
  horasExtra: number,
  horasNoExtra = 0,
): HorasDiaTrabajador => ({ ...trabajador, fecha, horasExtra, horasNoExtra });

/** Lunes 2026-10-05 a sábado 2026-10-10. */
const semanaOctubre = (extraPorDia: number, noExtraPorDia: number) =>
  [
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
  ].map((f) => dia(JUAN, f, extraPorDia, noExtraPorDia));

const tipos = (alertas: AlertaHoras[]) =>
  alertas.map((a) => `${a.tipo}@${a.periodo}`);

describe('evaluarAlertas', () => {
  describe('horas extra por día', () => {
    it('no alerta si las horas extra igualan el límite diario (2 h)', () => {
      expect(
        evaluarAlertas([dia(JUAN, '2026-10-06', 2, 8)], resolutor),
      ).toEqual([]);
    });

    it('alerta si superan el límite diario aunque sea por una centésima', () => {
      const [alerta] = evaluarAlertas(
        [dia(JUAN, '2026-10-06', 2.01, 8)],
        resolutor,
      );
      expect(alerta).toMatchObject({
        trabajadorId: 1,
        nombre: 'Juan Pérez',
        tipo: 'EXTRA_DIA',
        periodo: '2026-10-06',
        horas: 2.01,
        limite: 2,
      });
    });

    it('genera el mensaje en español con el día y el límite', () => {
      const [alerta] = evaluarAlertas(
        [dia(JUAN, '2026-10-06', 3, 8)],
        resolutor,
      );
      expect(alerta.mensaje).toBe(
        'Juan Pérez: 3 h extra el 2026-10-06 (límite 2 h/día)',
      );
    });

    it('usa coma decimal en el mensaje', () => {
      const [alerta] = evaluarAlertas(
        [dia(JUAN, '2026-10-06', 2.5, 8)],
        resolutor,
      );
      expect(alerta.mensaje).toBe(
        'Juan Pérez: 2,5 h extra el 2026-10-06 (límite 2 h/día)',
      );
    });

    it('suma las horas extra de varios proyectos el mismo día', () => {
      const alertas = evaluarAlertas(
        [dia(JUAN, '2026-10-06', 1.5, 4), dia(JUAN, '2026-10-06', 1, 4)],
        resolutor,
      );
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({ tipo: 'EXTRA_DIA', horas: 2.5 });
    });

    it('no acumula errores de punto flotante (0,1 + 0,2 + ... = 2 exacto)', () => {
      const filas = [0.1, 0.2, 0.3, 0.4, 1].map((h) =>
        dia(JUAN, '2026-10-06', h),
      );
      expect(evaluarAlertas(filas, resolutor)).toEqual([]);
    });

    it('cada día se evalúa por separado', () => {
      const alertas = evaluarAlertas(
        [
          dia(JUAN, '2026-10-05', 3),
          dia(JUAN, '2026-10-06', 1),
          dia(JUAN, '2026-10-07', 4),
        ],
        resolutor,
      );
      expect(tipos(alertas)).toEqual([
        'EXTRA_DIA@2026-10-05',
        'EXTRA_DIA@2026-10-07',
      ]);
    });

    it('usa el límite diario vigente en la fecha', () => {
      const conLimite3 = new ResolutorParametros([
        ...FILAS_PARAMETROS,
        {
          codigo: CodigoParametro.LIMITE_HORAS_EXTRA_DIA,
          valor: 3,
          vigenteDesde: '2026-10-07',
        },
      ]);
      const alertas = evaluarAlertas(
        [dia(JUAN, '2026-10-06', 2.5), dia(JUAN, '2026-10-07', 2.5)],
        conLimite3,
      );
      expect(tipos(alertas)).toEqual(['EXTRA_DIA@2026-10-06']);
    });
  });

  describe('horas extra por semana', () => {
    it('no alerta si igualan el límite semanal (12 h)', () => {
      expect(evaluarAlertas(semanaOctubre(2, 6), resolutor)).toEqual([]);
    });

    it('alerta con el lunes como periodo si superan el límite semanal', () => {
      const filas = [...semanaOctubre(2, 6), dia(JUAN, '2026-10-11', 0.5)];
      const alertas = evaluarAlertas(filas, resolutor);
      expect(alertas).toEqual([
        expect.objectContaining({
          tipo: 'EXTRA_SEMANA',
          periodo: '2026-10-05',
          horas: 12.5,
          limite: 12,
          mensaje:
            'Juan Pérez: 12,5 h extra en la semana del 2026-10-05 (límite 12 h/semana)',
        }),
      ]);
    });

    it('el domingo pertenece a la semana que empezó el lunes anterior', () => {
      const filas = [
        dia(JUAN, '2026-10-04', 2), // domingo: semana del 2026-09-28
        ...semanaOctubre(2, 0), // 12 h en la semana del 2026-10-05
      ];
      expect(evaluarAlertas(filas, resolutor)).toEqual([]);
    });

    it('agrupa una semana que cruza de septiembre a octubre', () => {
      const filas = [
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
      ].map((f) => dia(JUAN, f, 2));
      const alertas = evaluarAlertas(filas, resolutor);
      expect(alertas).toEqual([
        expect.objectContaining({
          tipo: 'EXTRA_SEMANA',
          periodo: '2026-09-28',
          horas: 14,
        }),
      ]);
    });

    it('una semana que cruza de año se agrupa por su lunes y usa sus parámetros (44 h)', () => {
      const filas = [
        '2025-12-29',
        '2025-12-30',
        '2025-12-31',
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-04',
      ].map((f) => dia(JUAN, f, 2, 7)); // 14 h extra, 49 h no extra
      expect(tipos(evaluarAlertas(filas, resolutor))).toEqual([
        'EXTRA_SEMANA@2025-12-29',
        'JORNADA_SEMANA@2025-12-29',
      ]);
    });
  });

  describe('jornada máxima semanal (horas no extra)', () => {
    it('no alerta si las horas no extra igualan la jornada (42 h desde 2026-07-15)', () => {
      expect(evaluarAlertas(semanaOctubre(0, 7), resolutor)).toEqual([]);
    });

    it('alerta cuando superan la jornada, con mensaje de posibles extras no clasificadas', () => {
      const alertas = evaluarAlertas(semanaOctubre(0, 7.5), resolutor);
      expect(alertas).toEqual([
        expect.objectContaining({
          tipo: 'JORNADA_SEMANA',
          periodo: '2026-10-05',
          horas: 45,
          limite: 42,
          mensaje:
            'Juan Pérez: 45 h no extra en la semana del 2026-10-05 superan la jornada máxima de 42 h (posibles horas extra no clasificadas)',
        }),
      ]);
    });

    it('la semana del cambio de vigencia (miércoles 2026-07-15) usa la jornada del lunes: 44 h', () => {
      const filas = [
        '2026-07-13',
        '2026-07-14',
        '2026-07-15',
        '2026-07-16',
        '2026-07-17',
        '2026-07-18',
      ].map((f) => dia(JUAN, f, 0, 7.25)); // 43,5 h: supera 42 pero no 44
      expect(evaluarAlertas(filas, resolutor)).toEqual([]);
    });

    it('la semana siguiente al cambio ya usa 42 h', () => {
      const filas = [
        '2026-07-20',
        '2026-07-21',
        '2026-07-22',
        '2026-07-23',
        '2026-07-24',
        '2026-07-25',
      ].map((f) => dia(JUAN, f, 0, 7.25));
      expect(evaluarAlertas(filas, resolutor)).toEqual([
        expect.objectContaining({
          tipo: 'JORNADA_SEMANA',
          periodo: '2026-07-20',
          horas: 43.5,
          limite: 42,
        }),
      ]);
    });

    it('en la semana del cambio alerta solo por encima de 44 h', () => {
      const filas = [
        '2026-07-13',
        '2026-07-14',
        '2026-07-15',
        '2026-07-16',
        '2026-07-17',
        '2026-07-18',
      ].map((f) => dia(JUAN, f, 0, 7.5));
      expect(evaluarAlertas(filas, resolutor)).toEqual([
        expect.objectContaining({
          tipo: 'JORNADA_SEMANA',
          horas: 45,
          limite: 44,
        }),
      ]);
    });

    it('las horas no extra de varios proyectos se suman en la semana', () => {
      const filas = semanaOctubre(0, 4).flatMap((d) => [
        d,
        { ...d, horasNoExtra: 3.5 },
      ]);
      expect(evaluarAlertas(filas, resolutor)).toEqual([
        expect.objectContaining({ tipo: 'JORNADA_SEMANA', horas: 45 }),
      ]);
    });
  });

  describe('agrupación y orden', () => {
    it('separa trabajadores y ordena por nombre, periodo y tipo', () => {
      const filas = [...semanaOctubre(3, 8), dia(ANA, '2026-10-07', 2.5, 8)];
      const alertas = evaluarAlertas(filas, resolutor);
      expect(alertas.map((a) => `${a.nombre}|${a.tipo}@${a.periodo}`)).toEqual([
        'Ana Gómez|EXTRA_DIA@2026-10-07',
        'Juan Pérez|EXTRA_DIA@2026-10-05',
        'Juan Pérez|EXTRA_SEMANA@2026-10-05',
        'Juan Pérez|JORNADA_SEMANA@2026-10-05',
        'Juan Pérez|EXTRA_DIA@2026-10-06',
        'Juan Pérez|EXTRA_DIA@2026-10-07',
        'Juan Pérez|EXTRA_DIA@2026-10-08',
        'Juan Pérez|EXTRA_DIA@2026-10-09',
        'Juan Pérez|EXTRA_DIA@2026-10-10',
      ]);
    });

    it('no mezcla horas de trabajadores distintos el mismo día', () => {
      const filas = [dia(JUAN, '2026-10-06', 1.5), dia(ANA, '2026-10-06', 1.5)];
      expect(evaluarAlertas(filas, resolutor)).toEqual([]);
    });

    it('sin horas no hay alertas', () => {
      expect(evaluarAlertas([], resolutor)).toEqual([]);
    });

    it('no consulta parámetros de días sin horas extra', () => {
      const sinParametros = new ResolutorParametros([]);
      expect(
        evaluarAlertas([dia(JUAN, '2026-10-06', 0, 0)], sinParametros),
      ).toEqual([]);
    });

    it('propaga el error si no hay parámetros vigentes para la fecha', () => {
      expect(() =>
        evaluarAlertas([dia(JUAN, '2023-01-02', 3)], resolutor),
      ).toThrow(ParametroNoVigenteError);
    });
  });
});

describe('aHorasPorDia', () => {
  it('separa horas extra y no extra según el tipo y resuelve el nombre', () => {
    const tiposHora = new Map([
      [1, { esExtra: false }],
      [3, { esExtra: true }],
    ]);
    const nombres = new Map([[1, 'Juan Pérez']]);
    expect(
      aHorasPorDia(
        [
          {
            trabajadorId: 1,
            proyectoId: 10,
            tipoHoraId: 1,
            fecha: '2026-10-06',
            horas: 8,
          },
          {
            trabajadorId: 1,
            proyectoId: 11,
            tipoHoraId: 3,
            fecha: '2026-10-06',
            horas: 2,
          },
        ],
        tiposHora,
        nombres,
      ),
    ).toEqual([
      {
        trabajadorId: 1,
        nombre: 'Juan Pérez',
        fecha: '2026-10-06',
        horasExtra: 0,
        horasNoExtra: 8,
      },
      {
        trabajadorId: 1,
        nombre: 'Juan Pérez',
        fecha: '2026-10-06',
        horasExtra: 2,
        horasNoExtra: 0,
      },
    ]);
  });

  it('falla si el tipo de hora no está cargado', () => {
    expect(() =>
      aHorasPorDia(
        [
          {
            trabajadorId: 1,
            proyectoId: 1,
            tipoHoraId: 99,
            fecha: '2026-10-06',
            horas: 1,
          },
        ],
        new Map(),
        new Map(),
      ),
    ).toThrow('Tipo de hora 99');
  });
});

describe('filtros de alertas', () => {
  const alertas = evaluarAlertas(
    [
      dia(JUAN, '2026-09-30', 3), // semana del 2026-09-28
      ...['2026-09-28', '2026-09-29', '2026-10-01', '2026-10-02'].map((f) =>
        dia(JUAN, f, 2.5),
      ),
      dia(ANA, '2026-10-06', 3), // semana del 2026-10-05
    ],
    resolutor,
  );

  it('semanasQueCubren extiende el rango a lunes y domingo', () => {
    expect(semanasQueCubren('2026-10-01', '2026-10-31')).toEqual({
      desde: '2026-09-28',
      hasta: '2026-11-01',
    });
  });

  it('alertasEnRango: diarias dentro del rango y semanales que se solapan', () => {
    expect(tipos(alertasEnRango(alertas, '2026-10-01', '2026-10-31'))).toEqual([
      'EXTRA_DIA@2026-10-06', // Ana
      'EXTRA_SEMANA@2026-09-28', // Juan: la semana se solapa con octubre
      'EXTRA_DIA@2026-10-01',
      'EXTRA_DIA@2026-10-02',
    ]);
  });

  it('alertasEnRango excluye semanas que terminan antes del rango', () => {
    expect(tipos(alertasEnRango(alertas, '2026-10-05', '2026-10-31'))).toEqual([
      'EXTRA_DIA@2026-10-06',
    ]);
  });

  it('alertasDeCambios: solo el día modificado y su semana, del mismo trabajador', () => {
    const resultado = alertasDeCambios(alertas, [
      { trabajadorId: 1, fecha: '2026-10-01' },
    ]);
    expect(
      resultado.map((a) => `${a.trabajadorId}|${a.tipo}@${a.periodo}`),
    ).toEqual(['1|EXTRA_SEMANA@2026-09-28', '1|EXTRA_DIA@2026-10-01']);
  });

  it('alertasDeCambios ignora alertas de otros trabajadores', () => {
    expect(
      alertasDeCambios(alertas, [{ trabajadorId: 1, fecha: '2026-10-06' }]),
    ).toEqual([]);
  });
});
