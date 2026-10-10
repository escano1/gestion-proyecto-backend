import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { MaterialProyecto } from './material-proyecto.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import type { ActualizarMaterialDto, CrearMaterialDto } from './materiales.dto.js';
import { aMaterialRespuesta, type MaterialRespuesta } from './reglas-materiales.js';

const ENTIDAD = 'MaterialProyecto';

@Injectable()
export class MaterialesService {
  constructor(
    @InjectRepository(MaterialProyecto)
    private readonly materiales: Repository<MaterialProyecto>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(proyectoId: number): Promise<MaterialRespuesta[]> {
    await this.asegurarProyecto(this.dataSource.manager, proyectoId);
    const materiales = await this.materiales.find({
      where: { proyectoId },
      order: { id: 'DESC' },
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
      const material = await m.save(
        m.create(MaterialProyecto, {
          proyectoId,
          nombre: dto.nombre,
          unidadMedida: dto.unidadMedida,
          cantidadSolicitada: dto.cantidadSolicitada,
          precioUnitario: dto.precioUnitario,
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
      return aMaterialRespuesta(material);
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
      const guardado = await m.save(material);
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          antes,
          despues: guardado,
          usuario,
        },
        m,
      );
      return aMaterialRespuesta(guardado);
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
}
