import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AsignacionProyecto } from './asignacion-proyecto.entity.js';
import { aAsignacionRespuesta, type AsignacionRespuesta } from './asignacion-respuesta.js';
import type {
  ActualizarAsignacionDto,
  CrearAsignacionDto,
  FiltroAsignacionesDto,
} from './asignaciones.dto.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { RegistroHoras } from '../registro-horas/registro-horas.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';

@Injectable()
export class AsignacionesService {
  constructor(
    @InjectRepository(AsignacionProyecto)
    private readonly repositorio: Repository<AsignacionProyecto>,
    @InjectRepository(Trabajador)
    private readonly trabajadores: Repository<Trabajador>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar({ proyectoId, trabajadorId }: FiltroAsignacionesDto): Promise<AsignacionRespuesta[]> {
    const consulta = this.repositorio
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.trabajador', 't')
      .innerJoinAndSelect('a.proyecto', 'p')
      .orderBy('a.id', 'DESC');
    if (proyectoId) consulta.andWhere('a.proyectoId = :proyectoId', { proyectoId });
    if (trabajadorId) consulta.andWhere('a.trabajadorId = :trabajadorId', { trabajadorId });
    return (await consulta.getMany()).map(aAsignacionRespuesta);
  }

  async historialTrabajador(trabajadorId: number): Promise<AsignacionRespuesta[]> {
    if (!(await this.trabajadores.existsBy({ id: trabajadorId }))) {
      throw new NotFoundException('Trabajador no encontrado');
    }
    return this.listar({ trabajadorId });
  }

  async crear(dto: CrearAsignacionDto, usuario: UsuarioAutenticado): Promise<AsignacionRespuesta> {
    return this.dataSource.transaction(async (m) => {
      const trabajador = await m.findOneBy(Trabajador, { id: dto.trabajadorId });
      if (!trabajador) throw new NotFoundException('Trabajador no encontrado');
      const proyecto = await m.findOneBy(Proyecto, { id: dto.proyectoId });
      if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
      if (await m.existsBy(AsignacionProyecto, { trabajadorId: dto.trabajadorId, proyectoId: dto.proyectoId })) {
        throw new ConflictException('El trabajador ya está asignado a este proyecto');
      }

      const asignacion = await m.save(
        m.create(AsignacionProyecto, {
          trabajadorId: dto.trabajadorId,
          proyectoId: dto.proyectoId,
          rolEnProyecto: dto.rolEnProyecto ?? null,
        }),
      );
      await this.auditoria.registrar(
        {
          entidad: 'AsignacionProyecto',
          entidadId: asignacion.id,
          accion: AccionAuditoria.CREAR,
          despues: asignacion,
          usuario,
        },
        m,
      );
      asignacion.trabajador = trabajador;
      asignacion.proyecto = proyecto;
      return aAsignacionRespuesta(asignacion);
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarAsignacionDto,
    usuario: UsuarioAutenticado,
  ): Promise<AsignacionRespuesta> {
    return this.dataSource.transaction(async (m) => {
      const asignacion = await m.findOne(AsignacionProyecto, {
        where: { id },
        relations: { trabajador: true, proyecto: true },
      });
      if (!asignacion) throw new NotFoundException('Asignación no encontrada');

      const antes = structuredClone(asignacion);
      m.merge(AsignacionProyecto, asignacion, { rolEnProyecto: dto.rolEnProyecto });
      const guardada = await m.save(asignacion);
      await this.auditoria.registrar(
        {
          entidad: 'AsignacionProyecto',
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          antes,
          despues: guardada,
          usuario,
        },
        m,
      );
      return aAsignacionRespuesta(guardada);
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const asignacion = await m.findOneBy(AsignacionProyecto, { id });
      if (!asignacion) throw new NotFoundException('Asignación no encontrada');

      const registros = await m.countBy(RegistroHoras, {
        trabajadorId: asignacion.trabajadorId,
        proyectoId: asignacion.proyectoId,
      });
      if (registros > 0) {
        throw new ConflictException(
          `No se puede eliminar la asignación: el trabajador tiene ${registros} registro(s) de horas en este proyecto`,
        );
      }

      await m.delete(AsignacionProyecto, { id });
      await this.auditoria.registrar(
        {
          entidad: 'AsignacionProyecto',
          entidadId: id,
          accion: AccionAuditoria.ELIMINAR,
          antes: asignacion,
          usuario,
        },
        m,
      );
    });
  }
}
