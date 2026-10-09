import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { EstadoMaterial, MaterialProyecto } from './material-proyecto.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { hoyColombia } from '../../common/utils/fechas.js';
import type {
  ActualizarMaterialDto,
  CrearMaterialDto,
  FiltroMaterialesDto,
} from './materiales.dto.js';
import {
  aMaterialRespuesta,
  completarFechaEntrega,
  type MaterialRespuesta,
} from './reglas-materiales.js';

const ENTIDAD = 'MaterialProyecto';

@Injectable()
export class MaterialesService {
  constructor(
    @InjectRepository(MaterialProyecto)
    private readonly materiales: Repository<MaterialProyecto>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(proyectoId: number, { estado }: FiltroMaterialesDto): Promise<MaterialRespuesta[]> {
    await this.asegurarProyecto(this.dataSource.manager, proyectoId);
    const materiales = await this.materiales.find({
      where: estado ? { proyectoId, estado } : { proyectoId },
      relations: { solicitadoPor: true },
      order: { fechaSolicitud: 'DESC', id: 'DESC' },
    });
    return materiales.map(aMaterialRespuesta);
  }

  async crear(
    proyectoId: number,
    dto: CrearMaterialDto,
    usuario: UsuarioAutenticado,
  ): Promise<MaterialRespuesta> {
    return this.dataSource.transaction(async (m) => {
      await this.asegurarProyecto(m, proyectoId);
      const hoy = hoyColombia();
      const estado = dto.estado ?? EstadoMaterial.PENDIENTE;
      const material = await m.save(
        m.create(MaterialProyecto, {
          proyectoId,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          unidadMedida: dto.unidadMedida,
          cantidadSolicitada: dto.cantidadSolicitada,
          cantidadEntregada: 0,
          estado,
          fechaSolicitud: dto.fechaSolicitud ?? hoy,
          fechaRequerida: dto.fechaRequerida ?? null,
          fechaEntrega: completarFechaEntrega(estado, null, hoy),
          observaciones: dto.observaciones ?? null,
          solicitadoPorId: usuario.id,
        }),
      );
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: material.id,
          accion: AccionAuditoria.CREAR,
          despues: material,
          usuario,
        },
        m,
      );
      return this.obtenerRespuesta(m, material.id);
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarMaterialDto,
    usuario: UsuarioAutenticado,
  ): Promise<MaterialRespuesta> {
    return this.dataSource.transaction(async (m) => {
      const material = await this.buscar(m, id);
      const antes = structuredClone(material);
      m.merge(MaterialProyecto, material, dto);
      material.fechaEntrega = completarFechaEntrega(
        material.estado,
        material.fechaEntrega,
        hoyColombia(),
      );
      await m.save(material);
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          antes,
          despues: material,
          usuario,
        },
        m,
      );
      return this.obtenerRespuesta(m, id);
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const material = await this.buscar(m, id);
      await m.delete(MaterialProyecto, { id });
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ELIMINAR,
          antes: material,
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

  private async buscar(m: EntityManager, id: number): Promise<MaterialProyecto> {
    const material = await m.findOneBy(MaterialProyecto, { id });
    if (!material) throw new NotFoundException('Material no encontrado');
    return material;
  }

  private async obtenerRespuesta(m: EntityManager, id: number): Promise<MaterialRespuesta> {
    const material = await m.findOneOrFail(MaterialProyecto, {
      where: { id },
      relations: { solicitadoPor: true },
    });
    return aMaterialRespuesta(material);
  }
}
