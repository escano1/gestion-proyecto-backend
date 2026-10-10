import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { CodigoTipoHora, TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import {
  agruparHorasFinales,
  agruparHorasGuardadas,
  type ContextoValidacion,
  type DatosRegistro,
  type OpcionesValidacion,
  periodoCerrado,
  validarRegistro,
} from './validacion-registro.js';

const ORD = 1;
const HED = 3;
const INACTIVO = 9;
const TRABAJADOR = 5;
const PROYECTO = 7;
const OTRO_PROYECTO = 8;

const tipo = (
  id: number,
  codigo: CodigoTipoHora,
  extra: Partial<TipoHora> = {},
) =>
  Object.assign(new TipoHora(), {
    id,
    codigo,
    nombre: codigo,
    esExtra: false,
    esNocturna: false,
    esDominicalFestiva: false,
    orden: id,
    activo: true,
    ...extra,
  });

const trabajador = () =>
  Object.assign(new Trabajador(), { id: TRABAJADOR, nombre: 'Juan Pérez' });

const asignacion = (proyectoId: number) =>
  Object.assign(new AsignacionProyecto(), {
    trabajadorId: TRABAJADOR,
    proyectoId,
  });

const registro = (parcial: Partial<DatosRegistro> = {}): DatosRegistro => ({
  trabajadorId: TRABAJADOR,
  proyectoId: PROYECTO,
  fecha: '2026-10-06',
  detalles: [
    { tipoHoraId: ORD, horas: 8 },
    { tipoHoraId: HED, horas: 2 },
  ],
  ...parcial,
});

/** Contexto de una operación que toca solo `operacion`, con `guardadas` ya en la BD. */
function contexto(
  operacion: DatosRegistro[],
  extra: Partial<ContextoValidacion> = {},
  guardadas: { proyectoId: number; horas: number }[] = [],
): ContextoValidacion {
  return {
    hoy: '2026-10-08',
    tipos: new Map([
      [ORD, tipo(ORD, CodigoTipoHora.ORD)],
      [HED, tipo(HED, CodigoTipoHora.HED, { esExtra: true })],
      [INACTIVO, tipo(INACTIVO, CodigoTipoHora.NOC, { activo: false })],
    ]),
    trabajadores: new Map([[TRABAJADOR, trabajador()]]),
    proyectos: new Map([
      [PROYECTO, Object.assign(new Proyecto(), { id: PROYECTO })],
      [OTRO_PROYECTO, Object.assign(new Proyecto(), { id: OTRO_PROYECTO })],
    ]),
    asignaciones: [asignacion(PROYECTO), asignacion(OTRO_PROYECTO)],
    periodosCerrados: [],
    horasGuardadas: agruparHorasGuardadas(
      guardadas.map((g) => ({
        trabajadorId: TRABAJADOR,
        proyectoId: g.proyectoId,
        tipoHoraId: ORD,
        fecha: '2026-10-06',
        horas: g.horas,
      })),
    ),
    horasFinales: agruparHorasFinales(operacion),
    ...extra,
  };
}

const validar =
  (
    datos: DatosRegistro,
    extra: Partial<ContextoValidacion> = {},
    opciones: OpcionesValidacion = {},
    guardadas: { proyectoId: number; horas: number }[] = [],
  ) =>
  () =>
    validarRegistro(datos, contexto([datos], extra, guardadas), opciones);

describe('validarRegistro', () => {
  it('acepta un registro válido', () => {
    expect(validar(registro())).not.toThrow();
  });

  describe('detalles', () => {
    it('rechaza tipos de hora repetidos', () => {
      const datos = registro({
        detalles: [
          { tipoHoraId: ORD, horas: 4 },
          { tipoHoraId: ORD, horas: 4 },
        ],
      });
      expect(validar(datos)).toThrow(
        new BadRequestException('El tipo de hora 1 está repetido'),
      );
    });

    it('rechaza 0 horas fuera del lote', () => {
      const datos = registro({ detalles: [{ tipoHoraId: ORD, horas: 0 }] });
      expect(validar(datos)).toThrow(
        'Las horas deben ser mayores que 0 y máximo 24',
      );
    });

    it('en lote acepta 0 en algunos tipos', () => {
      const datos = registro({
        detalles: [
          { tipoHoraId: ORD, horas: 8 },
          { tipoHoraId: HED, horas: 0 },
        ],
      });
      expect(validar(datos, {}, { permitirCero: true })).not.toThrow();
    });

    it('exige al menos un tipo con horas', () => {
      const datos = registro({ detalles: [{ tipoHoraId: ORD, horas: 0 }] });
      expect(validar(datos, {}, { permitirCero: true })).toThrow(
        'Debe registrar horas en al menos un tipo de hora',
      );
      expect(validar(registro({ detalles: [] }))).toThrow(
        'Debe registrar horas',
      );
    });

    it('rechaza más de 24 horas en un tipo y más de 2 decimales', () => {
      expect(
        validar(registro({ detalles: [{ tipoHoraId: ORD, horas: 24.5 }] })),
      ).toThrow(BadRequestException);
      expect(
        validar(registro({ detalles: [{ tipoHoraId: ORD, horas: 7.555 }] })),
      ).toThrow('Las horas admiten máximo 2 decimales');
      expect(
        validar(registro({ detalles: [{ tipoHoraId: ORD, horas: 7.25 }] })),
      ).not.toThrow();
    });

    it('rechaza tipos inexistentes o inactivos', () => {
      expect(
        validar(registro({ detalles: [{ tipoHoraId: 99, horas: 1 }] })),
      ).toThrow('El tipo de hora 99 no existe o está inactivo');
      expect(
        validar(registro({ detalles: [{ tipoHoraId: INACTIVO, horas: 1 }] })),
      ).toThrow('El tipo de hora 9 no existe o está inactivo');
    });

    it('acepta un tipo inactivo que ya estaba en el registro', () => {
      const datos = registro({
        detalles: [{ tipoHoraId: INACTIVO, horas: 1 }],
      });
      expect(
        validar(datos, {}, { tiposPrevios: new Set([INACTIVO]) }),
      ).not.toThrow();
    });
  });

  describe('trabajador, proyecto y fecha', () => {
    it('404 si el trabajador o el proyecto no existen', () => {
      expect(validar(registro({ trabajadorId: 404 }))).toThrow(
        new NotFoundException('Trabajador no encontrado'),
      );
      expect(validar(registro({ proyectoId: 404 }))).toThrow(
        new NotFoundException('Proyecto no encontrado'),
      );
    });

    it('permite toda la semana en curso (hasta el domingo) y rechaza semanas futuras', () => {
      // hoy = jueves 2026-10-08
      expect(validar(registro({ fecha: '2026-10-08' }))).not.toThrow();
      expect(validar(registro({ fecha: '2026-10-10' }))).not.toThrow(); // sábado
      expect(validar(registro({ fecha: '2026-10-11' }))).not.toThrow(); // domingo
      expect(validar(registro({ fecha: '2026-10-12' }))).toThrow(
        'No se pueden registrar horas de semanas futuras',
      );
    });

  });

  describe('asignación', () => {
    it('exige que el trabajador esté asignado al proyecto', () => {
      expect(
        validar(registro(), { asignaciones: [asignacion(OTRO_PROYECTO)] }),
      ).toThrow('El trabajador no está asignado al proyecto');
      expect(
        validar(registro(), { asignaciones: [asignacion(PROYECTO)] }),
      ).not.toThrow();
    });
  });

  describe('periodo cerrado', () => {
    it('409 si la fecha pertenece a una liquidación cerrada', () => {
      const periodosCerrados = [
        { fechaInicio: '2026-10-01', fechaFin: '2026-10-15' },
      ];
      expect(validar(registro(), { periodosCerrados })).toThrow(
        new ConflictException('El periodo ya fue liquidado y cerrado'),
      );
    });

    it('periodoCerrado incluye ambos extremos', () => {
      const ctx = {
        periodosCerrados: [
          { fechaInicio: '2026-10-01', fechaFin: '2026-10-15' },
        ],
      };
      expect(periodoCerrado(ctx, '2026-10-01')).toBe(true);
      expect(periodoCerrado(ctx, '2026-10-15')).toBe(true);
      expect(periodoCerrado(ctx, '2026-10-16')).toBe(false);
    });
  });

  describe('máximo 24 h diarias en todos los proyectos', () => {
    it('acepta exactamente 24 h sumando otros proyectos', () => {
      expect(
        validar(registro(), {}, {}, [{ proyectoId: OTRO_PROYECTO, horas: 14 }]),
      ).not.toThrow();
    });

    it('rechaza si la suma con otros proyectos supera 24 h', () => {
      expect(
        validar(registro(), {}, {}, [
          { proyectoId: OTRO_PROYECTO, horas: 14.5 },
        ]),
      ).toThrow(
        'El trabajador sumaría 24.5 h el 2026-10-06 en todos los proyectos (máximo 24 h)',
      );
    });

    it('al editar no cuenta las horas anteriores del mismo registro', () => {
      const guardadas = [
        { proyectoId: PROYECTO, horas: 10 },
        { proyectoId: OTRO_PROYECTO, horas: 12 },
      ];
      expect(
        validar(
          registro({ detalles: [{ tipoHoraId: ORD, horas: 12 }] }),
          {},
          {},
          guardadas,
        ),
      ).not.toThrow();
      expect(
        validar(
          registro({ detalles: [{ tipoHoraId: ORD, horas: 13 }] }),
          {},
          {},
          guardadas,
        ),
      ).toThrow(BadRequestException);
    });

    it('en lote valida el estado final: otro ítem que reduce horas lo compensa', () => {
      const aumenta = registro({ detalles: [{ tipoHoraId: ORD, horas: 20 }] });
      const reduce = registro({
        proyectoId: OTRO_PROYECTO,
        detalles: [{ tipoHoraId: ORD, horas: 4 }],
      });
      const ctx = contexto([aumenta, reduce], {}, [
        { proyectoId: OTRO_PROYECTO, horas: 10 },
      ]);
      expect(() =>
        validarRegistro(aumenta, ctx, { permitirCero: true }),
      ).not.toThrow();
    });

    it('en lote suma los ítems del mismo día y prefija el mensaje', () => {
      const a = registro({ detalles: [{ tipoHoraId: ORD, horas: 13 }] });
      const b = registro({
        proyectoId: OTRO_PROYECTO,
        detalles: [{ tipoHoraId: ORD, horas: 12 }],
      });
      const ctx = contexto([a, b]);
      expect(() =>
        validarRegistro(b, ctx, {
          prefijo: 'Registro 2 (trabajador 5, 2026-10-06): ',
        }),
      ).toThrow(
        'Registro 2 (trabajador 5, 2026-10-06): El trabajador sumaría 25 h el 2026-10-06 en todos los proyectos (máximo 24 h)',
      );
    });

    it('un ítem de lote que elimina (0 h) descuenta las horas guardadas de ese proyecto', () => {
      const elimina = registro({ proyectoId: OTRO_PROYECTO, detalles: [] });
      const nuevo = registro({ detalles: [{ tipoHoraId: ORD, horas: 24 }] });
      const ctx = contexto([elimina, nuevo], {}, [
        { proyectoId: OTRO_PROYECTO, horas: 8 },
      ]);
      expect(() =>
        validarRegistro(nuevo, ctx, { permitirCero: true }),
      ).not.toThrow();
    });
  });

  it('aplica el prefijo a todos los errores', () => {
    expect(
      validar(
        registro({ trabajadorId: 404 }),
        {},
        { prefijo: 'Registro 1 (trabajador 404, 2026-10-06): ' },
      ),
    ).toThrow(
      'Registro 1 (trabajador 404, 2026-10-06): Trabajador no encontrado',
    );
  });
});
