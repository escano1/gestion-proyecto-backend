import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import {
  EstadoHerramienta,
  HerramientaProyecto,
} from './herramienta-proyecto.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { hoyColombia } from '../../common/utils/fechas.js';
import type {
  ActualizarHerramientaDto,
  CrearHerramientaDto,
  FiltroHerramientasDto,
} from './herramientas.dto.js';
import {
  aHerramientaRespuesta,
  completarFechaDevolucion,
  type HerramientaRespuesta,
  validarFechasHerramienta,
} from './reglas-herramientas.js';

const ENTIDAD = 'HerramientaProyecto';

@Injectable()
export class HerramientasService {
  constructor(
    @InjectRepository(HerramientaProyecto)
    private readonly herramientas: Repository<HerramientaProyecto>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(
    proyectoId: number,
    { estado }: FiltroHerramientasDto,
  ): Promise<HerramientaRespuesta[]> {
    await this.asegurarProyecto(this.dataSource.manager, proyectoId);
    const herramientas = await this.herramientas.find({
      where: estado ? { proyectoId, estado } : { proyectoId },
      relations: { responsable: true },
      order: { fechaAsignacion: 'DESC', id: 'DESC' },
    });
    const hoy = hoyColombia();
    return herramientas.map((h) => aHerramientaRespuesta(h, hoy));
  }

  async crear(
    proyectoId: number,
    dto: CrearHerramientaDto,
    usuario: UsuarioAutenticado,
  ): Promise<HerramientaRespuesta> {
    const fechaDevolucionPrevista = dto.fechaDevolucionPrevista ?? null;
    validarFechasHerramienta(dto.fechaAsignacion, fechaDevolucionPrevista);
    return this.dataSource.transaction(async (m) => {
      await this.asegurarProyecto(m, proyectoId);
      const responsableId = dto.responsableId ?? null;
      await this.validarResponsable(m, responsableId);
      const herramienta = await m.save(
        m.create(HerramientaProyecto, {
          proyectoId,
          nombre: dto.nombre,
          codigo: dto.codigo ?? null,
          cantidad: dto.cantidad,
          responsableId,
          fechaAsignacion: dto.fechaAsignacion,
          fechaDevolucionPrevista,
          fechaDevolucion: null,
          estado: EstadoHerramienta.ASIGNADA,
          observaciones: dto.observaciones ?? null,
        }),
      );
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: herramienta.id,
          accion: AccionAuditoria.CREAR,
          despues: herramienta,
          usuario,
        },
        m,
      );
      return this.obtenerRespuesta(m, herramienta.id);
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarHerramientaDto,
    usuario: UsuarioAutenticado,
  ): Promise<HerramientaRespuesta> {
    return this.dataSource.transaction(async (m) => {
      const herramienta = await this.buscar(m, id);
      if (dto.responsableId !== undefined && dto.responsableId !== herramienta.responsableId) {
        await this.validarResponsable(m, dto.responsableId);
      }
      const antes = structuredClone(herramienta);
      m.merge(HerramientaProyecto, herramienta, dto);
      validarFechasHerramienta(herramienta.fechaAsignacion, herramienta.fechaDevolucionPrevista);
      herramienta.fechaDevolucion = completarFechaDevolucion(
        herramienta.estado,
        herramienta.fechaDevolucion,
        hoyColombia(),
      );
      await m.save(herramienta);
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          antes,
          despues: herramienta,
          usuario,
        },
        m,
      );
      return this.obtenerRespuesta(m, id);
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const herramienta = await this.buscar(m, id);
      await m.delete(HerramientaProyecto, { id });
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ELIMINAR,
          antes: herramienta,
          usuario,
        },
        m,
      );
    });
  }

  private async asegurarProyecto(m: EntityManager, proyectoId: number): Promise<void> {
    if (!(await m.existsBy(Proyecto, { id: proyectoId }))) {
      throw new NotFoundException('Proyecto no encontrado');
    }
  }

  private async validarResponsable(m: EntityManager, responsableId: number | null): Promise<void> {
    if (responsableId !== null && !(await m.existsBy(Trabajador, { id: responsableId }))) {
      throw new BadRequestException('El trabajador responsable no existe');
    }
  }

  private async buscar(m: EntityManager, id: number): Promise<HerramientaProyecto> {
    const herramienta = await m.findOneBy(HerramientaProyecto, { id });
    if (!herramienta) throw new NotFoundException('Herramienta no encontrada');
    return herramienta;
  }

  private async obtenerRespuesta(m: EntityManager, id: number): Promise<HerramientaRespuesta> {
    const herramienta = await m.findOneOrFail(HerramientaProyecto, {
      where: { id },
      relations: { responsable: true },
    });
    return aHerramientaRespuesta(herramienta, hoyColombia());
  }
}
