import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, type EntityManager, Repository } from 'typeorm';
import { AsignacionProyecto } from './asignacion-proyecto.entity.js';
import { aAsignacionRespuesta, type AsignacionRespuesta } from './asignacion-respuesta.js';
import {
  esRangoValido,
  type RangoFechas,
  rangosSeSolapan,
  tramosExcluidos,
} from './rangos-fechas.js';
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
import { hoyColombia } from '../../common/utils/fechas.js';

type ClaveAsignacion = Pick<AsignacionProyecto, 'trabajadorId' | 'proyectoId'>;

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

  async listar(filtro: FiltroAsignacionesDto): Promise<AsignacionRespuesta[]> {
    const { proyectoId, trabajadorId, vigenteEn, desde, hasta } = filtro;
    if (desde && hasta && desde > hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    const consulta = this.consultaBase();
    if (proyectoId) consulta.andWhere('a.proyectoId = :proyectoId', { proyectoId });
    if (trabajadorId) consulta.andWhere('a.trabajadorId = :trabajadorId', { trabajadorId });
    if (vigenteEn) {
      consulta.andWhere(
        'a.fechaInicio <= :vigenteEn AND (a.fechaFin IS NULL OR a.fechaFin >= :vigenteEn)',
        { vigenteEn },
      );
    }
    if (desde) consulta.andWhere('(a.fechaFin IS NULL OR a.fechaFin >= :desde)', { desde });
    if (hasta) consulta.andWhere('a.fechaInicio <= :hasta', { hasta });
    return this.aRespuestas(await consulta.getMany());
  }

  /** Historial del trabajador, más reciente primero. */
  async historialTrabajador(trabajadorId: number): Promise<AsignacionRespuesta[]> {
    if (!(await this.trabajadores.existsBy({ id: trabajadorId }))) {
      throw new NotFoundException('Trabajador no encontrado');
    }
    const asignaciones = await this.consultaBase()
      .andWhere('a.trabajadorId = :trabajadorId', { trabajadorId })
      .getMany();
    return this.aRespuestas(asignaciones);
  }

  async crear(dto: CrearAsignacionDto, usuario: UsuarioAutenticado): Promise<AsignacionRespuesta> {
    const rango: RangoFechas = { inicio: dto.fechaInicio, fin: dto.fechaFin ?? null };
    this.validarRango(rango);

    return this.dataSource.transaction(async (m) => {
      const trabajador = await this.bloquearTrabajador(m, dto.trabajadorId);
      const proyecto = await m.findOneBy(Proyecto, { id: dto.proyectoId });
      if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
      this.validarIngreso(rango, trabajador);
      await this.verificarSinSolapamiento(m, dto, rango);

      const asignacion = await m.save(
        m.create(AsignacionProyecto, {
          trabajadorId: dto.trabajadorId,
          proyectoId: dto.proyectoId,
          fechaInicio: rango.inicio,
          fechaFin: rango.fin,
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
      return aAsignacionRespuesta(asignacion, hoyColombia());
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarAsignacionDto,
    usuario: UsuarioAutenticado,
  ): Promise<AsignacionRespuesta> {
    return this.dataSource.transaction(async (m) => {
      const asignacion = await this.bloquearAsignacion(m, id);
      const trabajador = await this.bloquearTrabajador(m, asignacion.trabajadorId);

      const anterior: RangoFechas = { inicio: asignacion.fechaInicio, fin: asignacion.fechaFin };
      const nuevo: RangoFechas = {
        inicio: dto.fechaInicio ?? anterior.inicio,
        fin: dto.fechaFin === undefined ? anterior.fin : dto.fechaFin,
      };
      this.validarRango(nuevo);
      this.validarIngreso(nuevo, trabajador);
      await this.verificarSinSolapamiento(m, asignacion, nuevo, id);

      const excluidos = await this.contarRegistrosHoras(m, asignacion, tramosExcluidos(anterior, nuevo));
      if (excluidos > 0) {
        throw new ConflictException(
          `El nuevo rango deja por fuera ${excluidos} registro(s) de horas del trabajador en este proyecto`,
        );
      }

      const antes = structuredClone(asignacion);
      m.merge(AsignacionProyecto, asignacion, {
        fechaInicio: nuevo.inicio,
        fechaFin: nuevo.fin,
        rolEnProyecto: dto.rolEnProyecto,
      });
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
      guardada.trabajador = trabajador;
      guardada.proyecto = await m.findOneByOrFail(Proyecto, { id: guardada.proyectoId });
      return aAsignacionRespuesta(guardada, hoyColombia());
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const asignacion = await this.bloquearAsignacion(m, id);
      const registros = await this.contarRegistrosHoras(m, asignacion, [
        { inicio: asignacion.fechaInicio, fin: asignacion.fechaFin },
      ]);
      if (registros > 0) {
        throw new ConflictException(
          `No se puede eliminar la asignación: el trabajador tiene ${registros} registro(s) de horas en este proyecto dentro de su rango`,
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

  private consultaBase() {
    return this.repositorio
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.trabajador', 't')
      .innerJoinAndSelect('a.proyecto', 'p')
      .orderBy('a.fechaInicio', 'DESC')
      .addOrderBy('a.id', 'DESC');
  }

  private aRespuestas(asignaciones: AsignacionProyecto[]): AsignacionRespuesta[] {
    const hoy = hoyColombia();
    return asignaciones.map((a) => aAsignacionRespuesta(a, hoy));
  }

  private validarRango(rango: RangoFechas): void {
    if (!esRangoValido(rango)) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio');
    }
  }

  private validarIngreso(rango: RangoFechas, trabajador: Trabajador): void {
    if (rango.inicio < trabajador.fechaIngreso) {
      throw new BadRequestException(
        `La fecha de inicio no puede ser anterior a la fecha de ingreso del trabajador (${trabajador.fechaIngreso})`,
      );
    }
  }

  private async bloquearAsignacion(m: EntityManager, id: number): Promise<AsignacionProyecto> {
    const asignacion = await m.findOne(AsignacionProyecto, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!asignacion) throw new NotFoundException('Asignación no encontrada');
    return asignacion;
  }

  /**
   * Serializa las escrituras de asignaciones del mismo trabajador para que la verificación
   * de solapamiento no tenga carreras. FOR NO KEY UPDATE no bloquea las FK de otras tablas.
   */
  private async bloquearTrabajador(m: EntityManager, id: number): Promise<Trabajador> {
    const trabajador = await m.findOne(Trabajador, {
      where: { id },
      lock: { mode: 'for_no_key_update' },
    });
    if (!trabajador) throw new NotFoundException('Trabajador no encontrado');
    return trabajador;
  }

  private async verificarSinSolapamiento(
    m: EntityManager,
    { trabajadorId, proyectoId }: ClaveAsignacion,
    rango: RangoFechas,
    excluirId?: number,
  ): Promise<void> {
    const existentes = await m.findBy(AsignacionProyecto, { trabajadorId, proyectoId });
    const choque = existentes.find(
      (otra) =>
        otra.id !== excluirId &&
        rangosSeSolapan(rango, { inicio: otra.fechaInicio, fin: otra.fechaFin }),
    );
    if (choque) {
      throw new ConflictException(
        `El trabajador ya tiene una asignación a este proyecto que se cruza con esas fechas (${choque.fechaInicio} a ${choque.fechaFin ?? 'sin fecha de fin'})`,
      );
    }
  }

  private async contarRegistrosHoras(
    m: EntityManager,
    { trabajadorId, proyectoId }: ClaveAsignacion,
    tramos: RangoFechas[],
  ): Promise<number> {
    if (!tramos.length) return 0;
    return m
      .getRepository(RegistroHoras)
      .createQueryBuilder('r')
      .where('r.trabajadorId = :trabajadorId', { trabajadorId })
      .andWhere('r.proyectoId = :proyectoId', { proyectoId })
      .andWhere(
        new Brackets((qb) => {
          tramos.forEach((tramo, i) => {
            const parametros: Record<string, string> = { [`inicio${i}`]: tramo.inicio };
            let condicion = `r.fecha >= :inicio${i}`;
            if (tramo.fin !== null) {
              condicion += ` AND r.fecha <= :fin${i}`;
              parametros[`fin${i}`] = tramo.fin;
            }
            qb.orWhere(`(${condicion})`, parametros);
          });
        }),
      )
      .getCount();
  }
}
