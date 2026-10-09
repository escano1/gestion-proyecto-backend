import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import {
  EstadoTrabajador,
  TipoJornada,
  Trabajador,
} from './trabajador.entity.js';
import {
  cambioAfectaNomina,
  erroresTrabajador,
  normalizarJornada,
  patronBusqueda,
} from './reglas-trabajador.js';
import type {
  ActualizarTrabajadorDto,
  CrearTrabajadorDto,
  FiltroTrabajadoresDto,
} from './trabajadores.dto.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import { EstadoLiquidacion, LiquidacionNomina } from '../nomina/nomina.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';

/** `merge` ignora los `undefined` del DTO, así que estos valores quedan si el campo se omite. */
const VALORES_POR_DEFECTO = {
  tipoJornada: TipoJornada.COMPLETA,
  horasSemanales: null,
  aplicaAuxilioTransporte: true,
  fechaRetiro: null,
  estado: EstadoTrabajador.ACTIVO,
  email: null,
  telefono: null,
  eps: null,
  fondoPension: null,
} as const satisfies Partial<Trabajador>;

@Injectable()
export class TrabajadoresService {
  constructor(
    @InjectRepository(Trabajador)
    private readonly repositorio: Repository<Trabajador>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  listar({ estado, q }: FiltroTrabajadoresDto): Promise<Trabajador[]> {
    const consulta = this.repositorio
      .createQueryBuilder('t')
      .orderBy('t.nombre', 'ASC')
      .addOrderBy('t.id', 'ASC');
    if (estado) consulta.andWhere('t.estado = :estado', { estado });
    if (q) {
      consulta.andWhere('(t.nombre ILIKE :patron OR t.numeroDocumento ILIKE :patron)', {
        patron: patronBusqueda(q),
      });
    }
    return consulta.getMany();
  }

  async obtener(id: number): Promise<Trabajador> {
    const trabajador = await this.repositorio.findOneBy({ id });
    if (!trabajador) throw new NotFoundException('Trabajador no encontrado');
    return trabajador;
  }

  async crear(dto: CrearTrabajadorDto, usuario: UsuarioAutenticado): Promise<Trabajador> {
    return this.dataSource.transaction(async (m) => {
      await this.verificarDocumentoDisponible(m, dto.numeroDocumento);
      const trabajador = m.merge<Trabajador>(Trabajador, m.create(Trabajador), VALORES_POR_DEFECTO, dto);
      this.aplicarReglas(trabajador);

      const guardado = await m.save(trabajador);
      // Un ingreso dentro de un periodo en borrador cambia quién se liquida en él.
      await this.marcarLiquidacionesParaRecalculo(m, guardado.fechaIngreso);
      await this.auditoria.registrar(
        {
          entidad: 'Trabajador',
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
    dto: ActualizarTrabajadorDto,
    usuario: UsuarioAutenticado,
  ): Promise<Trabajador> {
    return this.dataSource.transaction(async (m) => {
      const trabajador = await m.findOneBy(Trabajador, { id });
      if (!trabajador) throw new NotFoundException('Trabajador no encontrado');
      if (dto.numeroDocumento && dto.numeroDocumento !== trabajador.numeroDocumento) {
        await this.verificarDocumentoDisponible(m, dto.numeroDocumento);
      }

      const antes = structuredClone(trabajador);
      m.merge(Trabajador, trabajador, dto);
      this.aplicarReglas(trabajador);

      const guardado = await m.save(trabajador);
      if (cambioAfectaNomina(antes, guardado)) {
        await this.marcarLiquidacionesParaRecalculo(m);
      }
      await this.auditoria.registrar(
        {
          entidad: 'Trabajador',
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

  private aplicarReglas(trabajador: Trabajador): void {
    normalizarJornada(trabajador);
    const errores = erroresTrabajador(trabajador);
    if (errores.length) throw new BadRequestException(errores);
  }

  private async verificarDocumentoDisponible(
    m: EntityManager,
    numeroDocumento: string,
  ): Promise<void> {
    if (await m.existsBy(Trabajador, { numeroDocumento })) {
      throw new ConflictException('Ya existe un trabajador con ese número de documento');
    }
  }

  /** Sin `desde` marca todas las liquidaciones en borrador. */
  private async marcarLiquidacionesParaRecalculo(
    m: EntityManager,
    desde?: string,
  ): Promise<void> {
    const consulta = m
      .createQueryBuilder()
      .update(LiquidacionNomina)
      .set({ requiereRecalculo: true })
      .where('estado = :estado', { estado: EstadoLiquidacion.BORRADOR });
    if (desde) consulta.andWhere('fecha_fin >= :desde', { desde });
    await consulta.execute();
  }
}
