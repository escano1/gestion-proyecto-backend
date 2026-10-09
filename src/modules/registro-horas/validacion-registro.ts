import {
  BadRequestException,
  ConflictException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common';
import {
  type EntityManager,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { CERO, dec, type Decimal, sumar } from '../../common/utils/dinero.js';
import { hoyColombia, type Fecha } from '../../common/utils/fechas.js';
import { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import {
  EstadoLiquidacion,
  LiquidacionNomina,
} from '../nomina/nomina.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import {
  consultarHorasAgregadas,
  type FilaHorasAgregada,
} from './consulta-horas.js';

export const MAXIMO_HORAS_DIA = 24;
export const MENSAJE_PERIODO_CERRADO = 'El periodo ya fue liquidado y cerrado';

export interface DetalleEntrada {
  tipoHoraId: number;
  horas: number;
}

export interface DatosRegistro {
  trabajadorId: number;
  proyectoId: number;
  fecha: Fecha;
  detalles: DetalleEntrada[];
}

type HorasPorProyecto = ReadonlyMap<number, Decimal>;

/** Datos precargados para validar uno o varios registros sin consultar la BD por ítem. */
export interface ContextoValidacion {
  hoy: Fecha;
  tipos: ReadonlyMap<number, TipoHora>;
  trabajadores: ReadonlyMap<number, Trabajador>;
  proyectos: ReadonlyMap<number, Proyecto>;
  asignaciones: readonly AsignacionProyecto[];
  periodosCerrados: readonly { fechaInicio: Fecha; fechaFin: Fecha }[];
  /** Horas guardadas antes de la operación, por `trabajador|fecha` y proyecto. */
  horasGuardadas: ReadonlyMap<string, HorasPorProyecto>;
  /** Horas que quedarán tras la operación en los registros que ella toca. */
  horasFinales: ReadonlyMap<string, HorasPorProyecto>;
}

export interface OpcionesValidacion {
  /** Prefijo de los mensajes de error (identifica el ítem en un lote). */
  prefijo?: string;
  /** En lote, 0 horas indica que ese tipo no se registra. */
  permitirCero?: boolean;
  /** Tipos ya presentes en el registro: se aceptan aunque hoy estén inactivos. */
  tiposPrevios?: ReadonlySet<number>;
}

export const claveDia = (trabajadorId: number, fecha: Fecha): string =>
  `${trabajadorId}|${fecha}`;

export const horasPositivas = (detalles: DetalleEntrada[]): DetalleEntrada[] =>
  detalles.filter((d) => d.horas > 0);

export const totalHoras = (detalles: DetalleEntrada[]): Decimal =>
  sumar(detalles.map((d) => dec(d.horas)));

export function periodoCerrado(
  ctx: Pick<ContextoValidacion, 'periodosCerrados'>,
  fecha: Fecha,
): boolean {
  return ctx.periodosCerrados.some(
    (p) => p.fechaInicio <= fecha && fecha <= p.fechaFin,
  );
}

function tieneAsignacionVigente(
  ctx: ContextoValidacion,
  datos: DatosRegistro,
): boolean {
  return ctx.asignaciones.some(
    (a) =>
      a.trabajadorId === datos.trabajadorId &&
      a.proyectoId === datos.proyectoId &&
      a.fechaInicio <= datos.fecha &&
      (a.fechaFin === null || datos.fecha <= a.fechaFin),
  );
}

/** Horas del día en todos los proyectos una vez aplicada la operación. */
function horasDelDiaTrasOperacion(
  ctx: ContextoValidacion,
  datos: DatosRegistro,
): Decimal {
  const clave = claveDia(datos.trabajadorId, datos.fecha);
  const finales = ctx.horasFinales.get(clave) ?? new Map<number, Decimal>();
  const guardadas = ctx.horasGuardadas.get(clave) ?? new Map<number, Decimal>();
  let total = sumar([...finales.values()]);
  for (const [proyectoId, horas] of guardadas) {
    if (!finales.has(proyectoId)) total = total.plus(horas);
  }
  return total;
}

type ClaseExcepcion = new (mensaje: string) => HttpException;

/**
 * Reglas de negocio de un registro de horas (compartidas por POST, PATCH y PUT /lote).
 * Lanza 400/404/409 con el mensaje precedido de `opciones.prefijo`.
 */
export function validarRegistro(
  datos: DatosRegistro,
  ctx: ContextoValidacion,
  opciones: OpcionesValidacion = {},
): void {
  const error = (Excepcion: ClaseExcepcion, mensaje: string) =>
    new Excepcion(`${opciones.prefijo ?? ''}${mensaje}`);

  const vistos = new Set<number>();
  for (const d of datos.detalles) {
    if (vistos.has(d.tipoHoraId)) {
      throw error(
        BadRequestException,
        `El tipo de hora ${d.tipoHoraId} está repetido`,
      );
    }
    vistos.add(d.tipoHoraId);

    const minimoValido = opciones.permitirCero ? d.horas >= 0 : d.horas > 0;
    if (!minimoValido || d.horas > MAXIMO_HORAS_DIA) {
      throw error(
        BadRequestException,
        opciones.permitirCero
          ? 'Las horas deben estar entre 0 y 24'
          : 'Las horas deben ser mayores que 0 y máximo 24',
      );
    }
    if (dec(d.horas).decimalPlaces() > 2) {
      throw error(BadRequestException, 'Las horas admiten máximo 2 decimales');
    }

    const tipo = ctx.tipos.get(d.tipoHoraId);
    if (!tipo || (!tipo.activo && !opciones.tiposPrevios?.has(d.tipoHoraId))) {
      throw error(
        BadRequestException,
        `El tipo de hora ${d.tipoHoraId} no existe o está inactivo`,
      );
    }
  }
  if (horasPositivas(datos.detalles).length === 0) {
    throw error(
      BadRequestException,
      'Debe registrar horas en al menos un tipo de hora',
    );
  }

  const trabajador = ctx.trabajadores.get(datos.trabajadorId);
  if (!trabajador) throw error(NotFoundException, 'Trabajador no encontrado');
  if (!ctx.proyectos.has(datos.proyectoId))
    throw error(NotFoundException, 'Proyecto no encontrado');

  if (datos.fecha > ctx.hoy) {
    throw error(
      BadRequestException,
      'No se pueden registrar horas en fechas futuras',
    );
  }
  if (datos.fecha < trabajador.fechaIngreso) {
    throw error(
      BadRequestException,
      `La fecha es anterior al ingreso del trabajador (${trabajador.fechaIngreso})`,
    );
  }
  if (trabajador.fechaRetiro && datos.fecha > trabajador.fechaRetiro) {
    throw error(
      BadRequestException,
      `La fecha es posterior al retiro del trabajador (${trabajador.fechaRetiro})`,
    );
  }
  if (!tieneAsignacionVigente(ctx, datos)) {
    throw error(
      BadRequestException,
      'El trabajador no tiene una asignación vigente al proyecto en esa fecha',
    );
  }
  if (periodoCerrado(ctx, datos.fecha))
    throw error(ConflictException, MENSAJE_PERIODO_CERRADO);

  const totalDia = horasDelDiaTrasOperacion(ctx, datos);
  if (totalDia.gt(MAXIMO_HORAS_DIA)) {
    throw error(
      BadRequestException,
      `El trabajador sumaría ${totalDia.toNumber()} h el ${datos.fecha} en todos los proyectos (máximo ${MAXIMO_HORAS_DIA} h)`,
    );
  }
}

const unicos = <T>(valores: T[]): T[] => [...new Set(valores)];

function agruparHoras(
  filas: {
    trabajadorId: number;
    proyectoId: number;
    fecha: Fecha;
    horas: Decimal;
  }[],
): Map<string, Map<number, Decimal>> {
  const mapa = new Map<string, Map<number, Decimal>>();
  for (const f of filas) {
    const clave = claveDia(f.trabajadorId, f.fecha);
    const porProyecto = mapa.get(clave) ?? new Map<number, Decimal>();
    porProyecto.set(
      f.proyectoId,
      (porProyecto.get(f.proyectoId) ?? CERO).plus(f.horas),
    );
    mapa.set(clave, porProyecto);
  }
  return mapa;
}

/** Horas ya guardadas por `trabajador|fecha` y proyecto. */
export const agruparHorasGuardadas = (filas: FilaHorasAgregada[]) =>
  agruparHoras(filas.map((f) => ({ ...f, horas: dec(f.horas) })));

/** Horas que dejará la operación por `trabajador|fecha` y proyecto (0 = registro eliminado). */
export const agruparHorasFinales = (items: DatosRegistro[]) =>
  agruparHoras(
    items.map((i) => ({ ...i, horas: totalHoras(horasPositivas(i.detalles)) })),
  );

/**
 * Carga lo necesario para validar `items` (que deben ser todos los registros de la operación).
 * Consultas secuenciales: comparten la conexión de la transacción.
 */
export async function cargarContexto(
  m: EntityManager,
  items: DatosRegistro[],
  hoy: Fecha = hoyColombia(),
): Promise<ContextoValidacion> {
  const trabajadorIds = unicos(items.map((i) => i.trabajadorId));
  const proyectoIds = unicos(items.map((i) => i.proyectoId));
  const fechas = items.map((i) => i.fecha).sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];

  const tipos = await m.find(TipoHora);
  const trabajadores = await m.findBy(Trabajador, { id: In(trabajadorIds) });
  const proyectos = await m.findBy(Proyecto, { id: In(proyectoIds) });
  const asignaciones = await m.findBy(AsignacionProyecto, {
    trabajadorId: In(trabajadorIds),
    proyectoId: In(proyectoIds),
  });
  const periodosCerrados = await m.find(LiquidacionNomina, {
    select: { id: true, fechaInicio: true, fechaFin: true },
    where: {
      estado: EstadoLiquidacion.CERRADA,
      fechaInicio: LessThanOrEqual(hasta),
      fechaFin: MoreThanOrEqual(desde),
    },
  });
  const filas = await consultarHorasAgregadas(m, {
    desde,
    hasta,
    trabajadorIds,
  });

  return {
    hoy,
    tipos: new Map(tipos.map((t) => [t.id, t])),
    trabajadores: new Map(trabajadores.map((t) => [t.id, t])),
    proyectos: new Map(proyectos.map((p) => [p.id, p])),
    asignaciones,
    periodosCerrados,
    horasGuardadas: agruparHorasGuardadas(filas),
    horasFinales: agruparHorasFinales(items),
  };
}
