import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  type EntityManager,
  type FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { BitacoraAdjunto, BitacoraEntrada } from './bitacora.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import type { CrearEntradaDto, FiltroBitacoraDto } from './bitacora.dto.js';
import {
  type AdjuntoNuevo,
  type ArchivoCargado,
  prepararAdjuntos,
  validarCantidadAdjuntos,
} from './adjuntos.js';
import {
  aAdjuntoRespuesta,
  aEntradaRespuesta,
  type EntradaRespuesta,
  validarRangoFechas,
  verificarAutorOAdmin,
} from './reglas-bitacora.js';

const ENTIDAD = 'BitacoraEntrada';

/** Adjunto con su contenido binario, para la descarga. */
export type AdjuntoConContenido = Pick<
  BitacoraAdjunto,
  'id' | 'nombreArchivo' | 'mimeType' | 'tamanoBytes' | 'contenido'
>;

function filtroPorFecha(desde?: string, hasta?: string): FindOptionsWhere<BitacoraEntrada> {
  if (desde && hasta) return { fecha: Between(desde, hasta) };
  if (desde) return { fecha: MoreThanOrEqual(desde) };
  if (hasta) return { fecha: LessThanOrEqual(hasta) };
  return {};
}

@Injectable()
export class BitacoraService {
  constructor(
    @InjectRepository(BitacoraEntrada)
    private readonly entradas: Repository<BitacoraEntrada>,
    @InjectRepository(BitacoraAdjunto)
    private readonly adjuntos: Repository<BitacoraAdjunto>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(
    proyectoId: number,
    { desde, hasta }: FiltroBitacoraDto,
  ): Promise<EntradaRespuesta[]> {
    validarRangoFechas(desde, hasta);
    await this.asegurarProyecto(this.dataSource.manager, proyectoId);
    const entradas = await this.entradas.find({
      where: { proyectoId, ...filtroPorFecha(desde, hasta) },
      relations: { autor: true, adjuntos: true },
      order: { fecha: 'DESC', creadoEn: 'DESC', id: 'DESC' },
    });
    return entradas.map(aEntradaRespuesta);
  }

  async crear(
    proyectoId: number,
    dto: CrearEntradaDto,
    archivos: ArchivoCargado[],
    usuario: UsuarioAutenticado,
  ): Promise<EntradaRespuesta> {
    const nuevos = prepararAdjuntos(archivos);
    validarCantidadAdjuntos(0, nuevos.length);
    return this.dataSource.transaction(async (m) => {
      await this.asegurarProyecto(m, proyectoId);
      const entrada = await m.save(
        m.create(BitacoraEntrada, {
          proyectoId,
          fecha: dto.fecha,
          descripcion: dto.descripcion,
          observaciones: dto.observaciones ?? null,
          autorId: usuario.id,
        }),
      );
      await this.guardarAdjuntos(m, entrada.id, nuevos);
      const respuesta = await this.obtenerRespuesta(m, entrada.id);
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: entrada.id,
          accion: AccionAuditoria.CREAR,
          despues: respuesta,
          usuario,
        },
        m,
      );
      return respuesta;
    });
  }

  async agregarAdjuntos(
    id: number,
    archivos: ArchivoCargado[],
    usuario: UsuarioAutenticado,
  ): Promise<EntradaRespuesta> {
    const nuevos = prepararAdjuntos(archivos);
    if (nuevos.length === 0) {
      throw new BadRequestException('Debe adjuntar al menos un archivo en el campo "archivos"');
    }
    return this.dataSource.transaction(async (m) => {
      // Bloqueo de la entrada: dos cargas simultáneas no pueden superar juntas el máximo.
      const entrada = await m.findOne(BitacoraEntrada, {
        where: { id },
        lock: { mode: 'for_no_key_update' },
      });
      if (!entrada) throw new NotFoundException('Entrada de bitácora no encontrada');
      validarCantidadAdjuntos(await m.countBy(BitacoraAdjunto, { entradaId: id }), nuevos.length);

      const guardados = await this.guardarAdjuntos(m, id, nuevos);
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          descripcion: `Adjuntos agregados: ${guardados.length}`,
          despues: { adjuntos: guardados },
          usuario,
        },
        m,
      );
      return this.obtenerRespuesta(m, id);
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const entrada = await m.findOne(BitacoraEntrada, {
        where: { id },
        relations: { autor: true, adjuntos: true },
      });
      if (!entrada) throw new NotFoundException('Entrada de bitácora no encontrada');
      verificarAutorOAdmin(usuario, entrada.autorId);

      // Los adjuntos se eliminan en cascada (FK ON DELETE CASCADE).
      await m.delete(BitacoraEntrada, { id });
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ELIMINAR,
          antes: aEntradaRespuesta(entrada),
          usuario,
        },
        m,
      );
    });
  }

  async eliminarAdjunto(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const adjunto = await m.findOne(BitacoraAdjunto, {
        where: { id },
        relations: { entrada: true },
      });
      if (!adjunto) throw new NotFoundException('Adjunto no encontrado');
      verificarAutorOAdmin(usuario, adjunto.entrada.autorId);

      await m.delete(BitacoraAdjunto, { id });
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: adjunto.entradaId,
          accion: AccionAuditoria.ACTUALIZAR,
          descripcion: 'Adjunto eliminado',
          antes: { adjunto: aAdjuntoRespuesta(adjunto) },
          usuario,
        },
        m,
      );
    });
  }

  async obtenerAdjunto(id: number): Promise<AdjuntoConContenido> {
    const adjunto = await this.adjuntos.findOne({
      where: { id },
      select: { id: true, nombreArchivo: true, mimeType: true, tamanoBytes: true, contenido: true },
    });
    if (!adjunto) throw new NotFoundException('Adjunto no encontrado');
    return adjunto;
  }

  private async asegurarProyecto(m: EntityManager, proyectoId: number): Promise<void> {
    if (!(await m.existsBy(Proyecto, { id: proyectoId }))) {
      throw new NotFoundException('Proyecto no encontrado');
    }
  }

  /** Devuelve solo metadatos (sin el binario) para auditoría. */
  private async guardarAdjuntos(m: EntityManager, entradaId: number, nuevos: AdjuntoNuevo[]) {
    if (nuevos.length === 0) return [];
    const guardados = await m.save(
      nuevos.map((adjunto) => m.create(BitacoraAdjunto, { entradaId, ...adjunto })),
    );
    return guardados.map(aAdjuntoRespuesta);
  }

  private async obtenerRespuesta(m: EntityManager, id: number): Promise<EntradaRespuesta> {
    const entrada = await m.findOneOrFail(BitacoraEntrada, {
      where: { id },
      relations: { autor: true, adjuntos: true },
    });
    return aEntradaRespuesta(entrada);
  }
}
