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
  calcularAuxilioTransporte,
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
import { EstadoLiquidacion, LiquidacionNomina, NominaTrabajador } from '../nomina/nomina.entity.js';
import { ParametrosService } from '../parametros/parametros.service.js';
import { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import { RegistroHoras } from '../registro-horas/registro-horas.entity.js';
import { hoyColombia } from '../../common/utils/fechas.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';

/** `merge` ignora los `undefined` del DTO, así que estos valores quedan si el campo se omite. */
const VALORES_POR_DEFECTO = {
  tipoJornada: TipoJornada.COMPLETA,
  horasSemanales: null,
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
    private readonly parametros: ParametrosService,
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
      await this.aplicarReglas(m, trabajador);

      const guardado = await m.save(trabajador);
      // Un trabajador activo nuevo entra en las liquidaciones en borrador.
      await this.marcarLiquidacionesParaRecalculo(m);
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
      await this.aplicarReglas(m, trabajador);

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

  private async aplicarReglas(m: EntityManager, trabajador: Trabajador): Promise<void> {
    normalizarJornada(trabajador);
    const resolutor = await this.parametros.crearResolutor(m);
    trabajador.aplicaAuxilioTransporte = calcularAuxilioTransporte(
      trabajador,
      resolutor.en(hoyColombia()),
    );
    const errores = erroresTrabajador(trabajador);
    if (errores.length) throw new BadRequestException(errores);
  }

  /**
   * Elimina el trabajador con todo lo que depende de él: horas registradas, asignaciones y sus
   * desprendibles de nómina. Las liquidaciones afectadas recalculan sus totales con los trabajadores
   * restantes; las que están en borrador además quedan marcadas para recálculo.
   */
  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const trabajador = await m.findOneBy(Trabajador, { id });
      if (!trabajador) throw new NotFoundException('Trabajador no encontrado');

      // Los detalles de horas y los conceptos de nómina se eliminan en cascada (FK ON DELETE CASCADE).
      const horas = await m.delete(RegistroHoras, { trabajadorId: id });
      const asignaciones = await m.delete(AsignacionProyecto, { trabajadorId: id });
      const liquidaciones = await m.find(NominaTrabajador, {
        select: { liquidacionId: true },
        where: { trabajadorId: id },
      });
      const nominas = await m.delete(NominaTrabajador, { trabajadorId: id });
      await m.delete(Trabajador, { id });

      await this.recalcularTotales(m, [...new Set(liquidaciones.map((n) => n.liquidacionId))]);
      if (horas.affected) await this.marcarLiquidacionesParaRecalculo(m);
      await this.auditoria.registrar(
        {
          entidad: 'Trabajador',
          entidadId: id,
          accion: AccionAuditoria.ELIMINAR,
          antes: trabajador,
          descripcion: `Eliminado con ${horas.affected ?? 0} registro(s) de horas, ${asignaciones.affected ?? 0} asignación(es) y ${nominas.affected ?? 0} desprendible(s) de nómina`,
          usuario,
        },
        m,
      );
    });
  }

  private async verificarDocumentoDisponible(
    m: EntityManager,
    numeroDocumento: string,
  ): Promise<void> {
    if (await m.existsBy(Trabajador, { numeroDocumento })) {
      throw new ConflictException('Ya existe un trabajador con ese número de documento');
    }
  }

  /** Vuelve a sumar los totales de las liquidaciones a partir de los desprendibles que quedan. */
  private async recalcularTotales(m: EntityManager, liquidacionIds: number[]): Promise<void> {
    if (liquidacionIds.length === 0) return;
    await m.query(
      `UPDATE liquidaciones_nomina l SET
         total_devengado = COALESCE(s.devengado, 0),
         total_deducciones = COALESCE(s.deducciones, 0),
         total_neto = COALESCE(s.neto, 0),
         numero_trabajadores = COALESCE(s.cantidad, 0)
       FROM (
         SELECT i.id, SUM(n.total_devengado) AS devengado, SUM(n.total_deducciones) AS deducciones,
                SUM(n.neto_pagar) AS neto, COUNT(n.id)::int AS cantidad
           FROM liquidaciones_nomina i
           LEFT JOIN nominas_trabajador n ON n.liquidacion_id = i.id
          WHERE i.id = ANY($1::int[])
          GROUP BY i.id
       ) s
       WHERE l.id = s.id`,
      [liquidacionIds],
    );
  }

  private async marcarLiquidacionesParaRecalculo(m: EntityManager): Promise<void> {
    await m
      .createQueryBuilder()
      .update(LiquidacionNomina)
      .set({ requiereRecalculo: true })
      .where('estado = :estado', { estado: EstadoLiquidacion.BORRADOR })
      .execute();
  }
}
