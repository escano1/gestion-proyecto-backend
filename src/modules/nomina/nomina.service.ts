import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, type ObjectLiteral, Repository } from 'typeorm';
import { redondear2 } from '../../common/utils/dinero.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import { ParametrosService } from '../parametros/parametros.service.js';
import { TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import { EstadoTrabajador, Trabajador } from '../trabajadores/trabajador.entity.js';
import {
  liquidarNomina,
  type HoraDeTrabajador,
  type ResultadoNomina,
} from './calculo/liquidador.js';
import {
  construirPeriodo,
  describirPeriodo,
  periodoDe,
  sufijoPeriodo,
  type Periodo,
} from './calculo/periodo.js';
import type { DatosConsolidado, DatosEmpresa } from './exportacion/consolidado.js';
import { generarConsolidadoExcel } from './exportacion/consolidado-excel.js';
import { generarConsolidadoPdf } from './exportacion/consolidado-pdf.js';
import { generarDesprendiblePdf } from './exportacion/desprendible-pdf.js';
import type { CrearLiquidacionDto } from './nomina.dto.js';
import {
  ConceptoNomina,
  EstadoLiquidacion,
  LiquidacionNomina,
  NominaTrabajador,
} from './nomina.entity.js';
import {
  aDesprendible,
  aLiquidacionResumen,
  aNominaResumen,
  type Desprendible,
  type LiquidacionConNominas,
  type LiquidacionResumen,
} from './nomina.respuestas.js';

const ENTIDAD_AUDITORIA = 'LiquidacionNomina';
const LIQUIDACION_NO_ENCONTRADA = 'Liquidación no encontrada';
// Clave del bloqueo consultivo que serializa la creación de liquidaciones (una por semana).
const BLOQUEO_CREACION_LIQUIDACION = 7_420_260;
// Lotes para no superar el límite de parámetros por consulta de PostgreSQL.
const LOTE_NOMINAS = 500;
const LOTE_CONCEPTOS = 1_000;

export const TIPO_PDF = 'application/pdf';
export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ArchivoGenerado {
  contenido: Buffer;
  nombre: string;
  tipo: string;
}

interface FilaHorasAgregadas {
  trabajadorId: number;
  fecha: string;
  tipoHoraId: number;
  horas: string;
}

function enLotes<T>(elementos: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < elementos.length; i += tamano) lotes.push(elementos.slice(i, i + tamano));
  return lotes;
}

function idInsertado(identificador: ObjectLiteral | undefined): number {
  const id: unknown = identificador?.id;
  if (typeof id !== 'number') throw new Error('No se obtuvo el id de la nómina insertada');
  return id;
}

/** Solo caracteres seguros para el nombre de archivo del header Content-Disposition. */
const segmentoArchivo = (texto: string): string => texto.replace(/[^A-Za-z0-9_-]/g, '');

@Injectable()
export class NominaService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LiquidacionNomina)
    private readonly liquidaciones: Repository<LiquidacionNomina>,
    @InjectRepository(NominaTrabajador)
    private readonly nominas: Repository<NominaTrabajador>,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  async listar(anio?: number): Promise<LiquidacionResumen[]> {
    const filas = await this.liquidaciones.find({
      ...(anio === undefined ? {} : { where: { anio } }),
      order: { fechaInicio: 'DESC' },
    });
    return filas.map(aLiquidacionResumen);
  }

  async obtener(id: number): Promise<LiquidacionConNominas> {
    const liquidacion = await this.liquidaciones.findOneBy({ id });
    if (!liquidacion) throw new NotFoundException(LIQUIDACION_NO_ENCONTRADA);
    return this.conNominas(this.dataSource.manager, liquidacion);
  }

  async crear(dto: CrearLiquidacionDto, usuario: UsuarioAutenticado): Promise<LiquidacionConNominas> {
    const periodo = construirPeriodo(dto.fecha);
    return this.dataSource.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock($1)', [BLOQUEO_CREACION_LIQUIDACION]);
      const existente = await m.findOneBy(LiquidacionNomina, { fechaInicio: periodo.fechaInicio });
      if (existente) {
        throw new ConflictException(
          `Ya existe la liquidación #${existente.id}: ${describirPeriodo(existente)}`,
        );
      }

      const liquidacion = await m.save(
        m.create(LiquidacionNomina, {
          anio: periodo.anio,
          fechaInicio: periodo.fechaInicio,
          fechaFin: periodo.fechaFin,
          estado: EstadoLiquidacion.BORRADOR,
          requiereRecalculo: false,
          totalDevengado: 0,
          totalDeducciones: 0,
          totalNeto: 0,
          numeroTrabajadores: 0,
          calculadaEn: null,
          creadoPorId: usuario.id,
          cerradaPorId: null,
          cerradaEn: null,
        }),
      );
      const calculada = await this.calcular(m, liquidacion, periodo);
      await this.auditar(m, AccionAuditoria.CALCULAR, liquidacion, usuario, null, calculada);
      return calculada;
    });
  }

  async recalcular(id: number, usuario: UsuarioAutenticado): Promise<LiquidacionConNominas> {
    return this.dataSource.transaction(async (m) => {
      const liquidacion = await this.bloquear(m, id);
      if (liquidacion.estado !== EstadoLiquidacion.BORRADOR) {
        throw new ConflictException('Solo se puede recalcular una liquidación en BORRADOR');
      }
      const antes = await this.conNominas(m, liquidacion);
      const despues = await this.calcular(m, liquidacion, periodoDe(liquidacion));
      await this.auditar(m, AccionAuditoria.CALCULAR, liquidacion, usuario, antes, despues);
      return despues;
    });
  }

  async cerrar(id: number, usuario: UsuarioAutenticado): Promise<LiquidacionConNominas> {
    return this.dataSource.transaction(async (m) => {
      const liquidacion = await this.bloquear(m, id);
      if (liquidacion.estado === EstadoLiquidacion.CERRADA) {
        throw new ConflictException('La liquidación ya está cerrada');
      }
      if (liquidacion.requiereRecalculo) {
        throw new ConflictException(
          'Hubo cambios en horas, salarios o parámetros después del cálculo: recalcule antes de cerrar',
        );
      }
      const antes = aLiquidacionResumen(liquidacion);
      liquidacion.estado = EstadoLiquidacion.CERRADA;
      liquidacion.cerradaPorId = usuario.id;
      liquidacion.cerradaEn = new Date();
      await m.save(liquidacion);
      const despues = await this.conNominas(m, liquidacion);
      await this.auditar(m, AccionAuditoria.CERRAR, liquidacion, usuario, antes, aLiquidacionResumen(liquidacion));
      return despues;
    });
  }

  async reabrir(id: number, usuario: UsuarioAutenticado): Promise<LiquidacionConNominas> {
    return this.dataSource.transaction(async (m) => {
      const liquidacion = await this.bloquear(m, id);
      if (liquidacion.estado !== EstadoLiquidacion.CERRADA) {
        throw new ConflictException('Solo se puede reabrir una liquidación CERRADA');
      }
      const antes = aLiquidacionResumen(liquidacion);
      liquidacion.estado = EstadoLiquidacion.BORRADOR;
      liquidacion.cerradaPorId = null;
      liquidacion.cerradaEn = null;
      await m.save(liquidacion);
      const despues = await this.conNominas(m, liquidacion);
      await this.auditar(m, AccionAuditoria.REABRIR, liquidacion, usuario, antes, aLiquidacionResumen(liquidacion));
      return despues;
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const liquidacion = await this.bloquear(m, id);
      if (liquidacion.estado !== EstadoLiquidacion.BORRADOR) {
        throw new ConflictException('Solo se puede eliminar una liquidación en BORRADOR');
      }
      const antes = await this.conNominas(m, liquidacion);
      // Las nóminas y sus conceptos se eliminan en cascada (FK ON DELETE CASCADE).
      await m.delete(LiquidacionNomina, { id });
      await this.auditar(m, AccionAuditoria.ELIMINAR, liquidacion, usuario, antes, null);
    });
  }

  async desprendible(id: number): Promise<Desprendible> {
    const nomina = await this.cargarDesprendible(id);
    return aDesprendible(nomina, nomina.liquidacion, nomina.conceptos);
  }

  async exportarExcel(id: number): Promise<ArchivoGenerado> {
    const datos = await this.datosConsolidado(id);
    return {
      contenido: await generarConsolidadoExcel(datos),
      nombre: `nomina-${sufijoPeriodo(datos.liquidacion)}.xlsx`,
      tipo: TIPO_XLSX,
    };
  }

  async exportarPdf(id: number): Promise<ArchivoGenerado> {
    const datos = await this.datosConsolidado(id);
    return {
      contenido: await generarConsolidadoPdf(datos),
      nombre: `nomina-${sufijoPeriodo(datos.liquidacion)}.pdf`,
      tipo: TIPO_PDF,
    };
  }

  async exportarDesprendiblePdf(id: number): Promise<ArchivoGenerado> {
    const nomina = await this.cargarDesprendible(id);
    const contenido = await generarDesprendiblePdf({
      empresa: this.empresa(),
      periodo: nomina.liquidacion,
      desprendible: aDesprendible(nomina, nomina.liquidacion, nomina.conceptos),
      generadoEn: new Date(),
    });
    const documento = segmentoArchivo(nomina.numeroDocumento) || String(nomina.trabajadorId);
    return {
      contenido,
      nombre: `desprendible-${documento}-${sufijoPeriodo(nomina.liquidacion)}.pdf`,
      tipo: TIPO_PDF,
    };
  }

  /**
   * Liquida a los trabajadores activos (y a quien tenga horas en la semana) y reemplaza las nóminas previas.
   * Debe ejecutarse dentro de la transacción que bloquea (o crea) la liquidación.
   */
  private async calcular(
    m: EntityManager,
    liquidacion: LiquidacionNomina,
    periodo: Periodo,
  ): Promise<LiquidacionConNominas> {
    const resolutor = await this.parametros.crearResolutor(m);
    const horas = await this.horasDelPeriodo(m, periodo);
    const conHoras = [...new Set(horas.map((h) => h.trabajadorId))];
    const trabajadores = await m.getRepository(Trabajador).find({
      where: [{ estado: EstadoTrabajador.ACTIVO }, ...(conHoras.length ? [{ id: In(conHoras) }] : [])],
      order: { nombre: 'ASC', id: 'ASC' },
    });
    const resultado = liquidarNomina(periodo, trabajadores, horas, (fecha) => resolutor.en(fecha));

    await m.delete(NominaTrabajador, { liquidacionId: liquidacion.id });
    await this.guardarNominas(m, liquidacion.id, resultado.nominas);

    liquidacion.totalDevengado = resultado.totalDevengado.toNumber();
    liquidacion.totalDeducciones = resultado.totalDeducciones.toNumber();
    liquidacion.totalNeto = resultado.totalNeto.toNumber();
    liquidacion.numeroTrabajadores = resultado.nominas.length;
    liquidacion.calculadaEn = new Date();
    liquidacion.requiereRecalculo = false;
    await m.save(liquidacion);
    return this.conNominas(m, liquidacion);
  }

  /** Horas agregadas por trabajador, fecha y tipo de hora dentro del periodo. */
  private async horasDelPeriodo(m: EntityManager, periodo: Periodo): Promise<HoraDeTrabajador[]> {
    const tipos = new Map((await m.find(TipoHora)).map((t) => [t.id, t]));
    const filas = await m.query<FilaHorasAgregadas[]>(
      `SELECT r.trabajador_id AS "trabajadorId",
              to_char(r.fecha, 'YYYY-MM-DD') AS "fecha",
              d.tipo_hora_id AS "tipoHoraId",
              SUM(d.horas)::text AS "horas"
         FROM registros_horas r
         JOIN registros_horas_detalle d ON d.registro_id = r.id
        WHERE r.fecha BETWEEN $1 AND $2
        GROUP BY r.trabajador_id, r.fecha, d.tipo_hora_id`,
      [periodo.fechaInicio, periodo.fechaFin],
    );
    return filas.map((fila) => {
      const tipoHora = tipos.get(Number(fila.tipoHoraId));
      if (!tipoHora) throw new Error(`Tipo de hora ${fila.tipoHoraId} inexistente`);
      return {
        trabajadorId: Number(fila.trabajadorId),
        fecha: fila.fecha,
        tipoHora,
        horas: fila.horas,
      };
    });
  }

  private async guardarNominas(
    m: EntityManager,
    liquidacionId: number,
    nominas: ResultadoNomina<Trabajador>['nominas'],
  ): Promise<void> {
    for (const lote of enLotes(nominas, LOTE_NOMINAS)) {
      const { identifiers } = await m.insert(
        NominaTrabajador,
        lote.map(({ trabajador: t, liquidacion: l }) => ({
          liquidacionId,
          trabajadorId: t.id,
          nombreTrabajador: t.nombre,
          tipoDocumento: t.tipoDocumento,
          numeroDocumento: t.numeroDocumento,
          cargo: t.cargo,
          tipoSalario: t.tipoSalario,
          salarioBase: t.salarioBase,
          valorHora: redondear2(l.valorHora).toNumber(),
          diasLaborados: l.diasLaborados,
          ibc: l.ibc.toNumber(),
          totalDevengado: l.totalDevengado.toNumber(),
          totalDeducciones: l.totalDeducciones.toNumber(),
          netoPagar: l.netoPagar.toNumber(),
          parametros: l.parametros,
          alertas: l.alertas,
        })),
      );
      const conceptos = lote.flatMap(({ liquidacion }, i) => {
        const nominaTrabajadorId = idInsertado(identifiers[i]);
        return liquidacion.conceptos.map((c) => ({
          nominaTrabajadorId,
          tipo: c.tipo,
          codigo: c.codigo,
          descripcion: c.descripcion,
          cantidad: c.cantidad?.toNumber() ?? null,
          valorUnitario: c.valorUnitario?.toNumber() ?? null,
          valor: c.valor.toNumber(),
          orden: c.orden,
        }));
      });
      for (const loteConceptos of enLotes(conceptos, LOTE_CONCEPTOS)) {
        await m.insert(ConceptoNomina, loteConceptos);
      }
    }
  }

  /** Carga la liquidación con bloqueo de fila para serializar cálculos, cierres y cambios de estado. */
  private async bloquear(m: EntityManager, id: number): Promise<LiquidacionNomina> {
    const liquidacion = await m.findOne(LiquidacionNomina, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!liquidacion) throw new NotFoundException(LIQUIDACION_NO_ENCONTRADA);
    return liquidacion;
  }

  private async conNominas(
    m: EntityManager,
    liquidacion: LiquidacionNomina,
  ): Promise<LiquidacionConNominas> {
    const nominas = await m.find(NominaTrabajador, {
      where: { liquidacionId: liquidacion.id },
      order: { nombreTrabajador: 'ASC', id: 'ASC' },
    });
    return { ...aLiquidacionResumen(liquidacion), nominas: nominas.map(aNominaResumen) };
  }

  private async cargarDesprendible(id: number) {
    const nomina = await this.nominas.findOne({
      where: { id },
      relations: { liquidacion: true, conceptos: true },
    });
    if (!nomina) throw new NotFoundException('Desprendible no encontrado');
    return nomina;
  }

  private async datosConsolidado(id: number): Promise<DatosConsolidado> {
    const liquidacion = await this.liquidaciones.findOneBy({ id });
    if (!liquidacion) throw new NotFoundException(LIQUIDACION_NO_ENCONTRADA);
    const nominas = await this.nominas.find({
      where: { liquidacionId: id },
      relations: { conceptos: true },
      order: { nombreTrabajador: 'ASC', id: 'ASC' },
    });
    return {
      empresa: this.empresa(),
      liquidacion: aLiquidacionResumen(liquidacion),
      nominas: nominas.map((n) => aDesprendible(n, liquidacion, n.conceptos)),
      generadoEn: new Date(),
    };
  }

  private empresa(): DatosEmpresa {
    return {
      nombre: this.config.get<string>('EMPRESA_NOMBRE') ?? 'Empresa',
      nit: this.config.get<string>('EMPRESA_NIT') ?? '',
    };
  }

  private async auditar(
    m: EntityManager,
    accion: AccionAuditoria,
    liquidacion: LiquidacionNomina,
    usuario: UsuarioAutenticado,
    antes: unknown,
    despues: unknown,
  ): Promise<void> {
    await this.auditoria.registrar(
      {
        entidad: ENTIDAD_AUDITORIA,
        entidadId: liquidacion.id,
        accion,
        antes,
        despues,
        descripcion: `Nómina ${describirPeriodo(liquidacion)}`,
        usuario,
      },
      m,
    );
  }
}
