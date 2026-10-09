import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { EstadoProyecto, Proyecto } from './proyecto.entity.js';
import { erroresFechasProyecto } from './reglas-proyecto.js';
import type {
  ActualizarProyectoDto,
  CrearProyectoDto,
  FiltroProyectosDto,
} from './proyectos.dto.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';

/** `merge` ignora los `undefined` del DTO, así que estos valores quedan si el campo se omite. */
const VALORES_POR_DEFECTO = {
  descripcion: null,
  fechaFinPlaneada: null,
  fechaFinReal: null,
  estado: EstadoProyecto.ACTIVO,
  presupuesto: null,
} as const satisfies Partial<Proyecto>;

@Injectable()
export class ProyectosService {
  constructor(
    @InjectRepository(Proyecto)
    private readonly repositorio: Repository<Proyecto>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  listar({ estado }: FiltroProyectosDto): Promise<Proyecto[]> {
    return this.repositorio.find({
      where: estado ? { estado } : {},
      order: { codigo: 'ASC' },
    });
  }

  async obtener(id: number): Promise<Proyecto> {
    const proyecto = await this.repositorio.findOneBy({ id });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    return proyecto;
  }

  async crear(dto: CrearProyectoDto, usuario: UsuarioAutenticado): Promise<Proyecto> {
    return this.dataSource.transaction(async (m) => {
      await this.verificarCodigoDisponible(m, dto.codigo);
      const proyecto = m.merge<Proyecto>(Proyecto, m.create(Proyecto), VALORES_POR_DEFECTO, dto);
      this.validarFechas(proyecto);

      const guardado = await m.save(proyecto);
      await this.auditoria.registrar(
        {
          entidad: 'Proyecto',
          entidadId: guardado.id,
          accion: AccionAuditoria.CREAR,
          despues: guardado,
          usuario,
        },
        m,
      );
      return guardado;
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarProyectoDto,
    usuario: UsuarioAutenticado,
  ): Promise<Proyecto> {
    return this.dataSource.transaction(async (m) => {
      const proyecto = await m.findOneBy(Proyecto, { id });
      if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
      if (dto.codigo && dto.codigo !== proyecto.codigo) {
        await this.verificarCodigoDisponible(m, dto.codigo);
      }

      const antes = structuredClone(proyecto);
      m.merge(Proyecto, proyecto, dto);
      this.validarFechas(proyecto);

      const guardado = await m.save(proyecto);
      await this.auditoria.registrar(
        {
          entidad: 'Proyecto',
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          antes,
          despues: guardado,
          usuario,
        },
        m,
      );
      return guardado;
    });
  }

  private validarFechas(proyecto: Proyecto): void {
    const errores = erroresFechasProyecto(proyecto);
    if (errores.length) throw new BadRequestException(errores);
  }

  private async verificarCodigoDisponible(m: EntityManager, codigo: string): Promise<void> {
    if (await m.existsBy(Proyecto, { codigo })) {
      throw new ConflictException('Ya existe un proyecto con ese código');
    }
  }
}
