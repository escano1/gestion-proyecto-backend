import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { dec, sumar } from '../../common/utils/dinero.js';
import { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import { MaterialProyecto } from '../materiales/material-proyecto.entity.js';
import { costoMaterial } from '../materiales/reglas-materiales.js';
import { LiquidacionNomina } from '../nomina/nomina.entity.js';
import { EstadoProyecto, Proyecto } from '../proyectos/proyecto.entity.js';
import type { AlertaHoras } from '../registro-horas/alertas-horas.js';
import type {
  CodigoTipoHora,
  TipoHora,
} from '../tipos-hora/tipo-hora.entity.js';
import {
  agruparPor,
  type FilaCosteada,
  horasPorTipo,
  resumirCostos,
} from './costos.js';
import { HorasCosteadasService } from './horas-costeadas.service.js';
import { MAXIMO_DIAS_REPORTE, validarRango } from './rango-fechas.js';
import {
  aAsignacion,
  aLiquidacionResumen,
  type AsignacionRespuesta,
  type LiquidacionResumen,
} from './reportes-respuesta.js';
import type {
  AgrupacionHoras,
  RangoFechasDto,
  RangoOpcionalDto,
  ReporteHorasDto,
} from './reportes.dto.js';

export interface ResumenHoras {
  horas: number;
  horasExtra: number;
  costo: number;
}

export interface FilaReporteHoras extends ResumenHoras {
  clave: string;
  etiqueta: string;
  porTipo: Partial<Record<CodigoTipoHora, number>>;
}

export interface ReporteHoras {
  desde: string;
  hasta: string;
  agrupacion: AgrupacionHoras;
  filas: FilaReporteHoras[];
  totales: ResumenHoras;
}

export interface CostoProyecto {
  proyectoId: number;
  codigo: string;
  nombre: string;
  estado: EstadoProyecto;
  presupuesto: number | null;
  horas: number;
  costo: number;
}

export interface HorasTipo {
  codigo: CodigoTipoHora;
  nombre: string;
  horas: number;
}

export interface ResumenProyecto {
  proyecto: Proyecto;
  asignaciones: AsignacionRespuesta[];
  horas: { total: number; horasExtra: number; porTipo: HorasTipo[] };
  costoManoObra: number;
  costoPorTrabajador: {
    trabajadorId: number;
    nombre: string;
    horas: number;
    costo: number;
  }[];
  costoMateriales: number;
  costoPorMaterial: {
    materialId: number;
    nombre: string;
    cantidad: number;
    costo: number;
  }[];
  gastoTotal: number;
}

function obtener<T>(
  mapa: ReadonlyMap<number, T>,
  id: number,
  entidad: string,
): T {
  const valor = mapa.get(id);
  if (valor === undefined) throw new Error(`${entidad} ${id} no cargado`);
  return valor;
}

/** Horas por tipo ordenadas como el catálogo, solo los tipos con horas. */
export function desglosePorTipo(
  filas: FilaCosteada[],
  tipos: ReadonlyMap<number, TipoHora>,
): HorasTipo[] {
  return [...horasPorTipo(filas)]
    .map(([tipoHoraId, horas]) => ({
      tipo: obtener(tipos, tipoHoraId, 'Tipo de hora'),
      horas,
    }))
    .sort((a, b) => a.tipo.orden - b.tipo.orden)
    .map(({ tipo, horas }) => ({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      horas,
    }));
}

@Injectable()
export class ReportesService {
  constructor(
    private readonly horasCosteadas: HorasCosteadasService,
    @InjectRepository(Proyecto)
    private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(AsignacionProyecto)
    private readonly asignaciones: Repository<AsignacionProyecto>,
    @InjectRepository(MaterialProyecto)
    private readonly materiales: Repository<MaterialProyecto>,
    @InjectRepository(LiquidacionNomina)
    private readonly liquidaciones: Repository<LiquidacionNomina>,
  ) {}

  async horas(consulta: ReporteHorasDto): Promise<ReporteHoras> {
    const { desde, hasta, trabajadorId, proyectoId, agrupacion } = consulta;
    validarRango(desde, hasta, MAXIMO_DIAS_REPORTE);

    const { filas, tipos, trabajadores } = await this.horasCosteadas.consultar({
      desde,
      hasta,
      trabajadorIds: trabajadorId ? [trabajadorId] : undefined,
      proyectoId,
    });
    const proyectos =
      agrupacion === 'proyecto'
        ? await this.proyectosPorId(filas)
        : new Map<number, Proyecto>();

    const describir: Record<
      AgrupacionHoras,
      (f: FilaCosteada) => { clave: string; etiqueta: string }
    > = {
      trabajador: (f) => ({
        clave: String(f.trabajadorId),
        etiqueta: obtener(trabajadores, f.trabajadorId, 'Trabajador').nombre,
      }),
      proyecto: (f) => {
        const p = obtener(proyectos, f.proyectoId, 'Proyecto');
        return {
          clave: String(f.proyectoId),
          etiqueta: `${p.codigo} - ${p.nombre}`,
        };
      },
      tipo: (f) => {
        const t = obtener(tipos, f.tipoHoraId, 'Tipo de hora');
        return { clave: t.codigo, etiqueta: t.nombre };
      },
      fecha: (f) => ({ clave: f.fecha, etiqueta: f.fecha }),
    };

    const ordenTipo = new Map(
      [...tipos.values()].map((t) => [t.codigo as string, t.orden]),
    );
    const comparar = (a: FilaReporteHoras, b: FilaReporteHoras): number => {
      if (agrupacion === 'tipo')
        return (ordenTipo.get(a.clave) ?? 0) - (ordenTipo.get(b.clave) ?? 0);
      if (agrupacion === 'fecha') return a.clave.localeCompare(b.clave);
      return a.etiqueta.localeCompare(b.etiqueta, 'es');
    };

    const grupos = agruparPor(filas, (f) => describir[agrupacion](f).clave);
    const filasReporte = [...grupos.values()]
      .map((grupo) => {
        const porTipo: Partial<Record<CodigoTipoHora, number>> = {};
        for (const { codigo, horas } of desglosePorTipo(grupo, tipos))
          porTipo[codigo] = horas;
        return {
          ...describir[agrupacion](grupo[0]),
          ...resumirCostos(grupo),
          porTipo,
        };
      })
      .sort(comparar);

    return {
      desde,
      hasta,
      agrupacion,
      filas: filasReporte,
      totales: resumirCostos(filas),
    };
  }

  async costosProyectos(
    consulta: RangoFechasDto,
  ): Promise<{ filas: CostoProyecto[]; total: number }> {
    validarRango(consulta.desde, consulta.hasta, MAXIMO_DIAS_REPORTE);
    const { filas } = await this.horasCosteadas.consultar(consulta);
    const costos = await this.costosPorProyecto(filas);
    return {
      filas: costos,
      total: sumar(costos.map((c) => dec(c.costo))).toNumber(),
    };
  }

  /** Costo por proyecto ordenado de mayor a menor. */
  async costosPorProyecto(filas: FilaCosteada[]): Promise<CostoProyecto[]> {
    const proyectos = await this.proyectosPorId(filas);
    return [...agruparPor(filas, (f) => f.proyectoId)]
      .map(([proyectoId, grupo]) => {
        const p = obtener(proyectos, proyectoId, 'Proyecto');
        const { horas, costo } = resumirCostos(grupo);
        return {
          proyectoId,
          codigo: p.codigo,
          nombre: p.nombre,
          estado: p.estado,
          presupuesto: p.presupuesto,
          horas,
          costo,
        };
      })
      .sort((a, b) => b.costo - a.costo || a.codigo.localeCompare(b.codigo));
  }

  async alertasHorasExtra(
    consulta: RangoFechasDto,
  ): Promise<{ alertas: AlertaHoras[] }> {
    validarRango(consulta.desde, consulta.hasta, MAXIMO_DIAS_REPORTE);
    return {
      alertas: await this.horasCosteadas.alertas(
        consulta.desde,
        consulta.hasta,
      ),
    };
  }

  async nominaPeriodos(anio: number): Promise<{
    filas: LiquidacionResumen[];
    totales: { devengado: number; deducciones: number; neto: number };
  }> {
    const liquidaciones = await this.liquidaciones.find({
      where: { anio },
      order: { fechaInicio: 'ASC' },
    });
    const total = (valor: (l: LiquidacionNomina) => number) =>
      sumar(liquidaciones.map((l) => dec(valor(l)))).toNumber();
    return {
      filas: liquidaciones.map(aLiquidacionResumen),
      totales: {
        devengado: total((l) => l.totalDevengado),
        deducciones: total((l) => l.totalDeducciones),
        neto: total((l) => l.totalNeto),
      },
    };
  }

  async resumenProyecto(
    id: number,
    rango: RangoOpcionalDto,
  ): Promise<ResumenProyecto> {
    const { desde, hasta } = rango;
    if (desde && hasta) validarRango(desde, hasta);

    const proyecto = await this.proyectos.findOneBy({ id });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    const asignaciones = await this.asignaciones.find({
      where: { proyectoId: id },
      relations: { trabajador: true, proyecto: true },
      order: { id: 'DESC' },
    });
    const { filas, tipos, trabajadores } = await this.horasCosteadas.consultar({
      proyectoId: id,
      desde,
      hasta,
    });
    const materiales = await this.materiales.find({
      where: { proyectoId: id },
      order: { nombre: 'ASC' },
    });

    const resumen = resumirCostos(filas);
    const costoPorMaterial = materiales
      .map((m) => ({
        materialId: m.id,
        nombre: m.nombre,
        cantidad: m.cantidadSolicitada,
        costo: costoMaterial(m),
      }))
      .sort((a, b) => b.costo - a.costo || a.nombre.localeCompare(b.nombre, 'es'));
    const costoMateriales = sumar(
      costoPorMaterial.map((m) => dec(m.costo)),
    ).toNumber();
    const costoPorTrabajador = [...agruparPor(filas, (f) => f.trabajadorId)]
      .map(([trabajadorId, grupo]) => {
        const { horas, costo } = resumirCostos(grupo);
        return {
          trabajadorId,
          nombre: obtener(trabajadores, trabajadorId, 'Trabajador').nombre,
          horas,
          costo,
        };
      })
      .sort(
        (a, b) => b.costo - a.costo || a.nombre.localeCompare(b.nombre, 'es'),
      );

    return {
      proyecto,
      asignaciones: asignaciones.map(aAsignacion),
      horas: {
        total: resumen.horas,
        horasExtra: resumen.horasExtra,
        porTipo: desglosePorTipo(filas, tipos),
      },
      costoManoObra: resumen.costo,
      costoPorTrabajador,
      costoMateriales,
      costoPorMaterial,
      gastoTotal: sumar([dec(resumen.costo), dec(costoMateriales)]).toNumber(),
    };
  }

  private async proyectosPorId(
    filas: FilaCosteada[],
  ): Promise<Map<number, Proyecto>> {
    const ids = [...new Set(filas.map((f) => f.proyectoId))];
    if (ids.length === 0) return new Map();
    const proyectos = await this.proyectos.findBy({ id: In(ids) });
    return new Map(proyectos.map((p) => [p.id, p]));
  }
}
