import { CodigoParametro } from '../parametros/parametro-legal.entity.js';
import {
  type FilaParametro,
  ParametroNoVigenteError,
  ResolutorParametros,
} from '../parametros/resolutor-parametros.js';
import type { FilaHorasAgregada } from '../registro-horas/consulta-horas.js';
import type { ClasificacionHora } from '../tipos-hora/recargos.js';
import { TipoSalario } from '../trabajadores/trabajador.entity.js';
import type { DatosSalariales } from '../trabajadores/valor-hora.js';
import {
  agruparPor,
  costearHoras,
  type FilaCosteada,
  horasPorTipo,
  resumirCostos,
} from './costos.js';

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

const MENSUAL = 1; // 2.100.000/mes: 10.000/h con 42 h (÷210), 9.545,45/h con 44 h (÷220)
const POR_HORA = 2; // 12.000/h
const PARCIAL = 3; // 2.100.000/mes con 24 h semanales: ÷120 = 17.500/h

const trabajadores = new Map<number, DatosSalariales>([
  [
    MENSUAL,
    {
      tipoSalario: TipoSalario.MENSUAL,
      salarioBase: 2_100_000,
      horasSemanales: null,
    },
  ],
  [
    POR_HORA,
    {
      tipoSalario: TipoSalario.POR_HORA,
      salarioBase: 12_000,
      horasSemanales: null,
    },
  ],
  [
    PARCIAL,
    {
      tipoSalario: TipoSalario.MENSUAL,
      salarioBase: 2_100_000,
      horasSemanales: 24,
    },
  ],
]);

const clasificacion = (
  esExtra: boolean,
  esNocturna: boolean,
  esDominicalFestiva: boolean,
) => ({
  esExtra,
  esNocturna,
  esDominicalFestiva,
});

const T = {
  ORD: 1,
  NOC: 2,
  HED: 3,
  HEN: 4,
  DOM: 5,
  DOMN: 6,
  HEDD: 7,
  HEDN: 8,
} as const;

const tipos = new Map<number, ClasificacionHora>([
  [T.ORD, clasificacion(false, false, false)],
  [T.NOC, clasificacion(false, true, false)],
  [T.HED, clasificacion(true, false, false)],
  [T.HEN, clasificacion(true, true, false)],
  [T.DOM, clasificacion(false, false, true)],
  [T.DOMN, clasificacion(false, true, true)],
  [T.HEDD, clasificacion(true, false, true)],
  [T.HEDN, clasificacion(true, true, true)],
]);

const fila = (
  trabajadorId: number,
  tipoHoraId: number,
  fecha: string,
  horas: number,
  proyectoId = 10,
): FilaHorasAgregada => ({
  trabajadorId,
  proyectoId,
  tipoHoraId,
  fecha,
  horas,
});

const costo = (f: FilaHorasAgregada): number =>
  costearHoras([f], trabajadores, tipos, resolutor)[0].costo.toNumber();

describe('costearHoras', () => {
  describe('valor hora según tipo de salario y jornada vigente', () => {
    it('mensual con jornada de 42 h (desde 2026-07-15): salario / 210', () => {
      expect(costo(fila(MENSUAL, T.ORD, '2026-07-20', 8))).toBe(80_000);
    });

    it('mensual con jornada de 44 h (hasta 2026-07-14): salario / 220, redondeado al peso', () => {
      // 8 × 2.100.000 / 220 = 76.363,64
      expect(costo(fila(MENSUAL, T.ORD, '2026-07-14', 8))).toBe(76_364);
    });

    it('el cambio de jornada aplica desde el mismo 2026-07-15', () => {
      expect(costo(fila(MENSUAL, T.ORD, '2026-07-15', 8))).toBe(80_000);
    });

    it('por hora: el salario base es el valor hora, sin importar la jornada', () => {
      expect(costo(fila(POR_HORA, T.ORD, '2026-07-14', 8))).toBe(96_000);
      expect(costo(fila(POR_HORA, T.ORD, '2026-07-20', 8))).toBe(96_000);
    });

    it('jornada parcial usa las horas semanales del trabajador (24 h → ÷120)', () => {
      expect(costo(fila(PARCIAL, T.ORD, '2026-07-14', 4))).toBe(70_000);
      expect(costo(fila(PARCIAL, T.ORD, '2026-07-20', 4))).toBe(70_000);
    });
  });

  describe('recargo dominical/festivo según vigencia', () => {
    it('0,80 antes de 2026-07-01 (con jornada de 44 h)', () => {
      // 8 × 9.545,4545 × 1,80 = 137.454,55
      expect(costo(fila(MENSUAL, T.DOM, '2026-06-28', 8))).toBe(137_455);
      expect(costo(fila(POR_HORA, T.DOM, '2026-06-30', 8))).toBe(172_800);
    });

    it('0,90 desde 2026-07-01 (todavía con jornada de 44 h)', () => {
      // 8 × 9.545,4545 × 1,90 = 145.090,91
      expect(costo(fila(MENSUAL, T.DOM, '2026-07-05', 8))).toBe(145_091);
      expect(costo(fila(POR_HORA, T.DOM, '2026-07-01', 8))).toBe(182_400);
    });

    it('0,90 con jornada de 42 h', () => {
      expect(costo(fila(MENSUAL, T.DOM, '2026-07-19', 8))).toBe(152_000);
    });

    it('el dominical se suma al nocturno y a las extras', () => {
      expect(costo(fila(MENSUAL, T.DOMN, '2026-07-19', 2))).toBe(45_000); // 1 + 0,35 + 0,90
      expect(costo(fila(MENSUAL, T.HEDD, '2026-07-19', 2))).toBe(43_000); // 1 + 0,25 + 0,90
      expect(costo(fila(MENSUAL, T.HEDN, '2026-07-19', 2))).toBe(53_000); // 1 + 0,75 + 0,90
      expect(costo(fila(MENSUAL, T.HEDD, '2026-06-28', 2))).toBe(39_136); // 2 × 9.545,45 × 2,05
    });
  });

  describe('recargos no dominicales', () => {
    it('nocturna 35 %, extra diurna 25 %, extra nocturna 75 % (sin acumular el nocturno)', () => {
      expect(costo(fila(MENSUAL, T.NOC, '2026-07-20', 2))).toBe(27_000);
      expect(costo(fila(MENSUAL, T.HED, '2026-07-20', 2))).toBe(25_000);
      expect(costo(fila(MENSUAL, T.HEN, '2026-07-20', 2))).toBe(35_000);
      expect(costo(fila(POR_HORA, T.HED, '2026-07-20', 2))).toBe(30_000);
    });
  });

  it('conserva los datos de la fila y marca las horas extra', () => {
    const [ordinaria, extra] = costearHoras(
      [
        fila(MENSUAL, T.ORD, '2026-07-20', 8, 77),
        fila(MENSUAL, T.HEN, '2026-07-20', 1, 77),
      ],
      trabajadores,
      tipos,
      resolutor,
    );
    expect(ordinaria).toMatchObject({
      trabajadorId: MENSUAL,
      proyectoId: 77,
      tipoHoraId: T.ORD,
      esExtra: false,
    });
    expect(extra.esExtra).toBe(true);
  });

  it('redondea cada fila al peso (mitad hacia arriba)', () => {
    // 1,5 × 9.545,4545 = 14.318,18 → 14.318; 0,05 × 9.545,4545 = 477,27 → 477
    expect(costo(fila(MENSUAL, T.ORD, '2026-07-14', 1.5))).toBe(14_318);
    expect(costo(fila(MENSUAL, T.ORD, '2026-07-14', 0.05))).toBe(477);
    // 0,25 × 12.000 × 1,25 = 3.750 exacto; 0,01 × 12.000 × 1,75 = 210
    expect(costo(fila(POR_HORA, T.HED, '2026-07-20', 0.25))).toBe(3_750);
    expect(costo(fila(POR_HORA, T.HEN, '2026-07-20', 0.01))).toBe(210);
  });

  it('falla si falta el trabajador o el tipo de hora', () => {
    expect(() => costo(fila(99, T.ORD, '2026-07-20', 1))).toThrow(
      'Trabajador 99 no cargado',
    );
    expect(() => costo(fila(MENSUAL, 99, '2026-07-20', 1))).toThrow(
      'Tipo de hora 99 no cargado',
    );
  });

  it('lanza ParametroNoVigenteError si no hay parámetros para la fecha', () => {
    expect(() => costo(fila(MENSUAL, T.ORD, '2024-03-01', 8))).toThrow(
      ParametroNoVigenteError,
    );
  });
});

describe('agregaciones', () => {
  const filas: FilaCosteada[] = costearHoras(
    [
      fila(MENSUAL, T.ORD, '2026-07-20', 8, 10),
      fila(MENSUAL, T.HED, '2026-07-20', 0.1, 10),
      fila(MENSUAL, T.HED, '2026-07-21', 0.2, 11),
      fila(POR_HORA, T.ORD, '2026-07-20', 4, 11),
    ],
    trabajadores,
    tipos,
    resolutor,
  );

  it('resumirCostos suma horas, horas extra y costo sin errores de punto flotante', () => {
    expect(resumirCostos(filas)).toEqual({
      horas: 12.3,
      horasExtra: 0.3, // 0,1 + 0,2 exacto
      costo: 80_000 + 1_250 + 2_500 + 48_000,
    });
  });

  it('resumirCostos de una lista vacía es cero', () => {
    expect(resumirCostos([])).toEqual({ horas: 0, horasExtra: 0, costo: 0 });
  });

  it('agruparPor agrupa por la clave dada conservando el orden', () => {
    const porProyecto = agruparPor(filas, (f) => f.proyectoId);
    expect([...porProyecto.keys()]).toEqual([10, 11]);
    expect(resumirCostos(porProyecto.get(11) ?? []).costo).toBe(50_500);
  });

  it('cualquier agrupación suma el mismo total', () => {
    const total = resumirCostos(filas).costo;
    const claves: ((f: FilaCosteada) => string | number)[] = [
      (f) => f.trabajadorId,
      (f) => f.fecha,
      (f) => f.tipoHoraId,
    ];
    for (const clave of claves) {
      const suma = [...agruparPor(filas, clave).values()].reduce(
        (s, grupo) => s + resumirCostos(grupo).costo,
        0,
      );
      expect(suma).toBe(total);
    }
  });

  it('horasPorTipo suma las horas de cada tipo', () => {
    expect(horasPorTipo(filas)).toEqual(
      new Map([
        [T.ORD, 12],
        [T.HED, 0.3],
      ]),
    );
  });
});
