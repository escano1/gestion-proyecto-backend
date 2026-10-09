import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  type EntityManager,
  type FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { Pagina } from '../../common/dto/paginacion.dto.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import type { Fecha } from '../../common/utils/fechas.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import {
  EstadoLiquidacion,
  LiquidacionNomina,
} from '../nomina/nomina.entity.js';
import { ParametrosService } from '../parametros/parametros.service.js';
import { ParametroNoVigenteError } from '../parametros/resolutor-parametros.js';
import {
  aHorasPorDia,
  alertasDeCambios,
  evaluarAlertas,
  semanasQueCubren,
} from './alertas-horas.js';
import { consultarHorasAgregadas } from './consulta-horas.js';
import {
  RegistroHoras,
  RegistroHorasDetalle,
} from './registro-horas.entity.js';
import {
  aRegistroHorasRespuesta,
  RELACIONES_REGISTRO,
  type RegistroHorasRespuesta,
} from './registro-horas-respuesta.js';
import type {
  ActualizarRegistroHorasDto,
  CrearRegistroHorasDto,
  FiltroRegistroHorasDto,
  LoteRegistroHorasDto,
} from './registro-horas.dto.js';
import {
  cargarContexto,
  type ContextoValidacion,
  type DatosRegistro,
  type DetalleEntrada,
  horasPositivas,
  MENSAJE_PERIODO_CERRADO,
  periodoCerrado,
  validarRegistro,
} from './validacion-registro.js';

const ENTIDAD = 'RegistroHoras';

export interface ResultadoRegistro {
  registro: RegistroHorasRespuesta;
  alertas: string[];
}

export interface ResultadoLote {
  creados: number;
  actualizados: number;
  eliminados: number;
  alertas: string[];
}

interface CambioRegistro {
  id: number;
  accion: AccionAuditoria;
  trabajadorId: number;
  fecha: Fecha;
  antes?: RegistroHorasRespuesta;
}

const normalizarObservacion = (
  observacion: string | null | undefined,
): string | null => observacion?.trim() || null;

const claveRegistro = (r: {
  trabajadorId: number;
  proyectoId: number;
  fecha: Fecha;
}) => `${r.trabajadorId}|${r.proyectoId}|${r.fecha}`;

const detallesDe = (registro: RegistroHoras): DetalleEntrada[] =>
  registro.detalles.map((d) => ({ tipoHoraId: d.tipoHoraId, horas: d.horas }));

function sinCambios(
  existente: RegistroHoras,
  positivos: DetalleEntrada[],
  observacion: string | null,
): boolean {
  const actuales = new Map(
    existente.detalles.map((d) => [d.tipoHoraId, d.horas]),
  );
  return (
    existente.observacion === observacion &&
    positivos.length === actuales.size &&
    new Set(positivos.map((d) => d.tipoHoraId)).size === positivos.length &&
    positivos.every((d) => actuales.get(d.tipoHoraId) === d.horas)
  );
}

@Injectable()
export class RegistroHorasService {
  constructor(
    @InjectRepository(RegistroHoras)
    private readonly repositorio: Repository<RegistroHoras>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
    private readonly parametros: ParametrosService,
  ) {}

  async listar(
    filtro: FiltroRegistroHorasDto,
  ): Promise<Pagina<RegistroHorasRespuesta>> {
    const { desde, hasta, trabajadorId, proyectoId, pagina, limite } = filtro;
    if (desde && hasta && desde > hasta) {
      throw new BadRequestException(
        'La fecha "desde" no puede ser posterior a "hasta"',
      );
    }

    const where: FindOptionsWhere<RegistroHoras> = {};
    if (desde && hasta) where.fecha = Between(desde, hasta);
    else if (desde) where.fecha = MoreThanOrEqual(desde);
    else if (hasta) where.fecha = LessThanOrEqual(hasta);
    if (trabajadorId) where.trabajadorId = trabajadorId;
    if (proyectoId) where.proyectoId = proyectoId;

    const [registros, total] = await this.repositorio.findAndCount({
      where,
      relations: RELACIONES_REGISTRO,
      order: { fecha: 'DESC', id: 'DESC' },
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return {
      datos: registros.map(aRegistroHorasRespuesta),
      total,
      pagina,
      limite,
    };
  }

  async obtener(id: number): Promise<RegistroHorasRespuesta> {
    return aRegistroHorasRespuesta(
      await this.buscar(this.dataSource.manager, id),
    );
  }

  crear(
    dto: CrearRegistroHorasDto,
    usuario: UsuarioAutenticado,
  ): Promise<ResultadoRegistro> {
    return this.dataSource.transaction(async (m) => {
      const { trabajadorId, proyectoId, fecha } = dto;
      if (
        await m.existsBy(RegistroHoras, { trabajadorId, proyectoId, fecha })
      ) {
        throw new ConflictException(
          'Ya existe un registro de horas para ese trabajador, proyecto y fecha',
        );
      }
      const datos: DatosRegistro = {
        trabajadorId,
        proyectoId,
        fecha,
        detalles: dto.detalles,
      };
      const ctx = await cargarContexto(m, [datos]);
      validarRegistro(datos, ctx);

      const id = await this.insertar(
        m,
        datos,
        normalizarObservacion(dto.observacion),
        usuario,
      );
      await this.marcarRecalculo(m, [fecha]);
      const registro = aRegistroHorasRespuesta(await this.buscar(m, id));
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.CREAR,
          despues: registro,
          usuario,
        },
        m,
      );
      return { registro, alertas: await this.alertas(m, [datos], ctx) };
    });
  }

  actualizar(
    id: number,
    dto: ActualizarRegistroHorasDto,
    usuario: UsuarioAutenticado,
  ): Promise<ResultadoRegistro> {
    return this.dataSource.transaction(async (m) => {
      const existente = await this.buscar(m, id);
      const antes = aRegistroHorasRespuesta(existente);
      const datos: DatosRegistro = {
        trabajadorId: existente.trabajadorId,
        proyectoId: existente.proyectoId,
        fecha: existente.fecha,
        detalles: dto.detalles ?? detallesDe(existente),
      };
      const ctx = await cargarContexto(m, [datos]);
      validarRegistro(datos, ctx, {
        tiposPrevios: new Set(existente.detalles.map((d) => d.tipoHoraId)),
      });

      const observacion =
        dto.observacion === undefined
          ? existente.observacion
          : normalizarObservacion(dto.observacion);
      await this.modificar(m, existente, datos.detalles, observacion, usuario);
      await this.marcarRecalculo(m, [existente.fecha]);
      const registro = aRegistroHorasRespuesta(await this.buscar(m, id));
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          antes,
          despues: registro,
          usuario,
        },
        m,
      );
      return { registro, alertas: await this.alertas(m, [datos], ctx) };
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const existente = await this.buscar(m, id);
      const cerrado = await m.existsBy(LiquidacionNomina, {
        estado: EstadoLiquidacion.CERRADA,
        fechaInicio: LessThanOrEqual(existente.fecha),
        fechaFin: MoreThanOrEqual(existente.fecha),
      });
      if (cerrado) throw new ConflictException(MENSAJE_PERIODO_CERRADO);

      await m.delete(RegistroHoras, { id });
      await this.marcarRecalculo(m, [existente.fecha]);
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ELIMINAR,
          antes: aRegistroHorasRespuesta(existente),
          usuario,
        },
        m,
      );
    });
  }

  /**
   * Upsert transaccional por (trabajador, proyecto, fecha). Los ítems sin cambios se omiten
   * (no se validan, auditan ni marcan recálculo); la suma diaria se valida sobre el estado final.
   */
  guardarLote(
    dto: LoteRegistroHorasDto,
    usuario: UsuarioAutenticado,
  ): Promise<ResultadoLote> {
    return this.dataSource.transaction(async (m) => {
      const items = dto.registros.map((r, i) => ({
        datos: {
          trabajadorId: r.trabajadorId,
          proyectoId: r.proyectoId,
          fecha: r.fecha,
          detalles: r.detalles,
        } satisfies DatosRegistro,
        observacion: r.observacion,
        prefijo: `Registro ${i + 1} (trabajador ${r.trabajadorId}, ${r.fecha}): `,
      }));

      const vistos = new Set<string>();
      for (const { datos, prefijo } of items) {
        const clave = claveRegistro(datos);
        if (vistos.has(clave)) {
          throw new BadRequestException(
            `${prefijo}el trabajador, proyecto y fecha están repetidos en el lote`,
          );
        }
        vistos.add(clave);
      }

      const existentes = await this.buscarExistentes(
        m,
        items.map((i) => i.datos),
      );
      const ctx = await cargarContexto(
        m,
        items.map((i) => i.datos),
      );
      const resultado = { creados: 0, actualizados: 0, eliminados: 0 };
      const cambios: CambioRegistro[] = [];

      for (const { datos, observacion: obs, prefijo } of items) {
        const existente = existentes.get(claveRegistro(datos));
        const positivos = horasPositivas(datos.detalles);
        const base = { trabajadorId: datos.trabajadorId, fecha: datos.fecha };

        if (positivos.length === 0) {
          if (!existente) continue;
          if (periodoCerrado(ctx, datos.fecha)) {
            throw new ConflictException(`${prefijo}${MENSAJE_PERIODO_CERRADO}`);
          }
          await m.delete(RegistroHoras, { id: existente.id });
          resultado.eliminados++;
          cambios.push({
            ...base,
            id: existente.id,
            accion: AccionAuditoria.ELIMINAR,
            antes: aRegistroHorasRespuesta(existente),
          });
          continue;
        }

        const observacion =
          obs === undefined
            ? (existente?.observacion ?? null)
            : normalizarObservacion(obs);
        if (existente && sinCambios(existente, positivos, observacion))
          continue;

        validarRegistro(datos, ctx, {
          prefijo,
          permitirCero: true,
          tiposPrevios: new Set(existente?.detalles.map((d) => d.tipoHoraId)),
        });
        if (existente) {
          await this.modificar(m, existente, positivos, observacion, usuario);
          resultado.actualizados++;
          cambios.push({
            ...base,
            id: existente.id,
            accion: AccionAuditoria.ACTUALIZAR,
            antes: aRegistroHorasRespuesta(existente),
          });
        } else {
          const id = await this.insertar(m, datos, observacion, usuario);
          resultado.creados++;
          cambios.push({ ...base, id, accion: AccionAuditoria.CREAR });
        }
      }

      if (cambios.length === 0) return { ...resultado, alertas: [] };

      await this.marcarRecalculo(
        m,
        cambios.map((c) => c.fecha),
      );
      await this.auditarLote(m, cambios, usuario);
      return { ...resultado, alertas: await this.alertas(m, cambios, ctx) };
    });
  }

  private async buscar(m: EntityManager, id: number): Promise<RegistroHoras> {
    const registro = await m.findOne(RegistroHoras, {
      where: { id },
      relations: RELACIONES_REGISTRO,
    });
    if (!registro)
      throw new NotFoundException('Registro de horas no encontrado');
    return registro;
  }

  private async buscarExistentes(
    m: EntityManager,
    items: DatosRegistro[],
  ): Promise<Map<string, RegistroHoras>> {
    const candidatos = await m.find(RegistroHoras, {
      where: {
        trabajadorId: In([...new Set(items.map((i) => i.trabajadorId))]),
        proyectoId: In([...new Set(items.map((i) => i.proyectoId))]),
        fecha: In([...new Set(items.map((i) => i.fecha))]),
      },
      relations: RELACIONES_REGISTRO,
    });
    return new Map(candidatos.map((r) => [claveRegistro(r), r]));
  }

  private async insertar(
    m: EntityManager,
    datos: DatosRegistro,
    observacion: string | null,
    usuario: UsuarioAutenticado,
  ): Promise<number> {
    const registro = await m.save(
      m.create(RegistroHoras, {
        trabajadorId: datos.trabajadorId,
        proyectoId: datos.proyectoId,
        fecha: datos.fecha,
        observacion,
        creadoPorId: usuario.id,
        actualizadoPorId: null,
      }),
    );
    await m.insert(
      RegistroHorasDetalle,
      horasPositivas(datos.detalles).map((d) => ({
        registroId: registro.id,
        tipoHoraId: d.tipoHoraId,
        horas: d.horas,
      })),
    );
    return registro.id;
  }

  /** Reemplaza los detalles borrando, actualizando e insertando en ese orden (respeta el único registro+tipo). */
  private async modificar(
    m: EntityManager,
    existente: RegistroHoras,
    detalles: DetalleEntrada[],
    observacion: string | null,
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    await m.update(
      RegistroHoras,
      { id: existente.id },
      { observacion, actualizadoPorId: usuario.id },
    );

    const nuevos = new Map(
      horasPositivas(detalles).map((d) => [d.tipoHoraId, d.horas]),
    );
    const sobrantes = existente.detalles.filter(
      (d) => !nuevos.has(d.tipoHoraId),
    );
    if (sobrantes.length) {
      await m.delete(RegistroHorasDetalle, {
        id: In(sobrantes.map((d) => d.id)),
      });
    }
    for (const detalle of existente.detalles) {
      const horas = nuevos.get(detalle.tipoHoraId);
      if (horas !== undefined && horas !== detalle.horas) {
        await m.update(RegistroHorasDetalle, { id: detalle.id }, { horas });
      }
    }
    const tiposActuales = new Set(existente.detalles.map((d) => d.tipoHoraId));
    const agregados = [...nuevos].filter(
      ([tipoHoraId]) => !tiposActuales.has(tipoHoraId),
    );
    if (agregados.length) {
      await m.insert(
        RegistroHorasDetalle,
        agregados.map(([tipoHoraId, horas]) => ({
          registroId: existente.id,
          tipoHoraId,
          horas,
        })),
      );
    }
  }

  /** Las liquidaciones en borrador que cubren las fechas deben recalcularse. */
  private async marcarRecalculo(
    m: EntityManager,
    fechas: Fecha[],
  ): Promise<void> {
    await m
      .createQueryBuilder()
      .update(LiquidacionNomina)
      .set({ requiereRecalculo: true })
      .where('estado = :estado', { estado: EstadoLiquidacion.BORRADOR })
      .andWhere(
        'EXISTS (SELECT 1 FROM unnest(CAST(:fechas AS date[])) AS f(dia) WHERE f.dia BETWEEN fecha_inicio AND fecha_fin)',
        { fechas: [...new Set(fechas)] },
      )
      .execute();
  }

  private async auditarLote(
    m: EntityManager,
    cambios: CambioRegistro[],
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    const vigentes = cambios.filter(
      (c) => c.accion !== AccionAuditoria.ELIMINAR,
    );
    const recargados = vigentes.length
      ? await m.find(RegistroHoras, {
          where: { id: In(vigentes.map((c) => c.id)) },
          relations: RELACIONES_REGISTRO,
        })
      : [];
    const despues = new Map(
      recargados.map((r) => [r.id, aRegistroHorasRespuesta(r)]),
    );

    for (const cambio of cambios) {
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: cambio.id,
          accion: cambio.accion,
          antes: cambio.antes,
          despues: despues.get(cambio.id),
          descripcion: 'Registro de horas por lote',
          usuario,
        },
        m,
      );
    }
  }

  /** Alertas (no bloqueantes) de los días y semanas afectados, con todas las horas del trabajador. */
  private async alertas(
    m: EntityManager,
    cambios: { trabajadorId: number; fecha: Fecha }[],
    ctx: ContextoValidacion,
  ): Promise<string[]> {
    const fechas = cambios.map((c) => c.fecha).sort();
    const filas = await consultarHorasAgregadas(m, {
      ...semanasQueCubren(fechas[0], fechas[fechas.length - 1]),
      trabajadorIds: [...new Set(cambios.map((c) => c.trabajadorId))],
    });
    if (filas.length === 0) return [];

    const nombres = new Map(
      [...ctx.trabajadores.values()].map((t) => [t.id, t.nombre]),
    );
    try {
      const resolutor = await this.parametros.crearResolutor(m);
      const alertas = evaluarAlertas(
        aHorasPorDia(filas, ctx.tipos, nombres),
        resolutor,
      );
      return alertasDeCambios(alertas, cambios).map((a) => a.mensaje);
    } catch (error) {
      if (error instanceof ParametroNoVigenteError) {
        return [
          `No se pudieron evaluar las alertas de horas: ${error.message}`,
        ];
      }
      throw error;
    }
  }
}
