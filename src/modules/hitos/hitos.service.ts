import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { HitoProyecto } from './hito-proyecto.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { hoyColombia } from '../../common/utils/fechas.js';
import { type AvanceProyecto, calcularAvance } from './avance.js';
import type { ActualizarHitoDto, CrearHitoDto } from './hitos.dto.js';
import {
  aHitoRespuesta,
  aplicarAvance,
  type HitoRespuesta,
  validarSumaPesos,
} from './reglas-hitos.js';

const ENTIDAD = 'HitoProyecto';

@Injectable()
export class HitosService {
  constructor(
    @InjectRepository(HitoProyecto)
    private readonly hitos: Repository<HitoProyecto>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(proyectoId: number): Promise<HitoRespuesta[]> {
    await this.asegurarProyecto(this.dataSource.manager, proyectoId);
    const hitos = await this.hitos.find({
      where: { proyectoId },
      order: { orden: 'ASC', fechaPlaneada: 'ASC', id: 'ASC' },
    });
    return hitos.map(aHitoRespuesta);
  }

  async avance(proyectoId: number): Promise<AvanceProyecto> {
    await this.asegurarProyecto(this.dataSource.manager, proyectoId);
    const hitos = await this.hitos.find({
      where: { proyectoId },
      select: { id: true, peso: true, porcentajeAvance: true, fechaPlaneada: true, fechaReal: true },
    });
    return calcularAvance(hitos, hoyColombia());
  }

  async crear(
    proyectoId: number,
    dto: CrearHitoDto,
    usuario: UsuarioAutenticado,
  ): Promise<HitoRespuesta> {
    return this.dataSource.transaction(async (m) => {
      await this.bloquearProyecto(m, proyectoId);
      const porcentajeAvance = dto.porcentajeAvance ?? 0;
      const hito = m.create(HitoProyecto, {
        proyectoId,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        orden: dto.orden ?? 0,
        fechaPlaneada: dto.fechaPlaneada,
        peso: dto.peso,
        porcentajeAvance,
        ...aplicarAvance(porcentajeAvance, null, hoyColombia()),
      });
      await this.validarPesos(m, hito);
      await m.save(hito);
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: hito.id,
          accion: AccionAuditoria.CREAR,
          despues: hito,
          usuario,
        },
        m,
      );
      return aHitoRespuesta(hito);
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarHitoDto,
    usuario: UsuarioAutenticado,
  ): Promise<HitoRespuesta> {
    return this.dataSource.transaction(async (m) => {
      const hito = await this.buscar(m, id);
      const cambiaPeso = dto.peso !== undefined;
      if (cambiaPeso) await this.bloquearProyecto(m, hito.proyectoId);
      const antes = structuredClone(hito);
      m.merge(HitoProyecto, hito, dto);
      Object.assign(hito, aplicarAvance(hito.porcentajeAvance, hito.fechaReal, hoyColombia()));
      if (cambiaPeso) await this.validarPesos(m, hito);
      await m.save(hito);
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          antes,
          despues: hito,
          usuario,
        },
        m,
      );
      return aHitoRespuesta(hito);
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const hito = await this.buscar(m, id);
      await m.delete(HitoProyecto, { id });
      await this.auditoria.registrar(
        {
          entidad: ENTIDAD,
          entidadId: id,
          accion: AccionAuditoria.ELIMINAR,
          antes: hito,
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

  /**
   * Serializa las escrituras de hitos de un mismo proyecto para que dos operaciones
   * concurrentes no superen juntas la suma de pesos. FOR NO KEY UPDATE no bloquea
   * las inserciones de otras tablas que referencian al proyecto.
   */
  private async bloquearProyecto(m: EntityManager, proyectoId: number): Promise<void> {
    const proyecto = await m.findOne(Proyecto, {
      where: { id: proyectoId },
      select: { id: true },
      lock: { mode: 'for_no_key_update' },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
  }

  private async validarPesos(m: EntityManager, hito: HitoProyecto): Promise<void> {
    const existentes = await m.find(HitoProyecto, {
      where: { proyectoId: hito.proyectoId },
      select: { id: true, peso: true },
    });
    validarSumaPesos([
      ...existentes.filter((h) => h.id !== hito.id).map((h) => h.peso),
      hito.peso,
    ]);
  }

  private async buscar(m: EntityManager, id: number): Promise<HitoProyecto> {
    const hito = await m.findOneBy(HitoProyecto, { id });
    if (!hito) throw new NotFoundException('Hito no encontrado');
    return hito;
  }
}
