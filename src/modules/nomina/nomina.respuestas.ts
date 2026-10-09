import type { TipoDocumento, TipoSalario } from '../trabajadores/trabajador.entity.js';
import type {
  ConceptoNomina,
  EstadoLiquidacion,
  LiquidacionNomina,
  NominaTrabajador,
  TipoConcepto,
  TipoPeriodo,
} from './nomina.entity.js';

// Formas de respuesta del contrato (docs/API.md, sección "Nómina").

export interface LiquidacionResumen {
  id: number;
  tipoPeriodo: TipoPeriodo;
  anio: number;
  mes: number;
  quincena: 1 | 2 | null;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoLiquidacion;
  requiereRecalculo: boolean;
  totalDevengado: number;
  totalDeducciones: number;
  totalNeto: number;
  numeroTrabajadores: number;
  calculadaEn: string | null;
  cerradaEn: string | null;
  creadoEn: string;
}

export interface NominaTrabajadorResumen {
  id: number;
  trabajadorId: number;
  nombreTrabajador: string;
  numeroDocumento: string;
  cargo: string;
  tipoSalario: TipoSalario;
  diasLaborados: number;
  ibc: number;
  totalDevengado: number;
  totalDeducciones: number;
  netoPagar: number;
  alertas: string[];
}

export interface LiquidacionConNominas extends LiquidacionResumen {
  nominas: NominaTrabajadorResumen[];
}

export interface ConceptoDesprendible {
  tipo: TipoConcepto;
  codigo: string;
  descripcion: string;
  cantidad: number | null;
  valorUnitario: number | null;
  valor: number;
}

export interface Desprendible extends NominaTrabajadorResumen {
  tipoDocumento: TipoDocumento;
  salarioBase: number;
  valorHora: number;
  parametros: Record<string, number>;
  liquidacion: {
    id: number;
    tipoPeriodo: TipoPeriodo;
    fechaInicio: string;
    fechaFin: string;
    estado: EstadoLiquidacion;
  };
  conceptos: ConceptoDesprendible[];
}

const iso = (fecha: Date | null): string | null => (fecha ? fecha.toISOString() : null);

export function aLiquidacionResumen(l: LiquidacionNomina): LiquidacionResumen {
  return {
    id: l.id,
    tipoPeriodo: l.tipoPeriodo,
    anio: l.anio,
    mes: l.mes,
    quincena: l.quincena === 1 || l.quincena === 2 ? l.quincena : null,
    fechaInicio: l.fechaInicio,
    fechaFin: l.fechaFin,
    estado: l.estado,
    requiereRecalculo: l.requiereRecalculo,
    totalDevengado: l.totalDevengado,
    totalDeducciones: l.totalDeducciones,
    totalNeto: l.totalNeto,
    numeroTrabajadores: l.numeroTrabajadores,
    calculadaEn: iso(l.calculadaEn),
    cerradaEn: iso(l.cerradaEn),
    creadoEn: l.creadoEn.toISOString(),
  };
}

export function aNominaResumen(n: NominaTrabajador): NominaTrabajadorResumen {
  return {
    id: n.id,
    trabajadorId: n.trabajadorId,
    nombreTrabajador: n.nombreTrabajador,
    numeroDocumento: n.numeroDocumento,
    cargo: n.cargo,
    tipoSalario: n.tipoSalario,
    diasLaborados: n.diasLaborados,
    ibc: n.ibc,
    totalDevengado: n.totalDevengado,
    totalDeducciones: n.totalDeducciones,
    netoPagar: n.netoPagar,
    alertas: n.alertas,
  };
}

/** Requiere `liquidacion` y `conceptos` cargados. */
export function aDesprendible(
  n: NominaTrabajador,
  liquidacion: LiquidacionNomina,
  conceptos: ConceptoNomina[],
): Desprendible {
  return {
    ...aNominaResumen(n),
    tipoDocumento: n.tipoDocumento as TipoDocumento,
    salarioBase: n.salarioBase,
    valorHora: n.valorHora,
    parametros: n.parametros,
    liquidacion: {
      id: liquidacion.id,
      tipoPeriodo: liquidacion.tipoPeriodo,
      fechaInicio: liquidacion.fechaInicio,
      fechaFin: liquidacion.fechaFin,
      estado: liquidacion.estado,
    },
    conceptos: [...conceptos]
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({
        tipo: c.tipo,
        codigo: c.codigo,
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        valorUnitario: c.valorUnitario,
        valor: c.valor,
      })),
  };
}
