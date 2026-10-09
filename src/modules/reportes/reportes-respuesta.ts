import type { Fecha } from '../../common/utils/fechas.js';
import type { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import {
  EstadoHerramienta,
  type HerramientaProyecto,
} from '../herramientas/herramienta-proyecto.entity.js';
import type { AvanceProyecto } from '../hitos/avance.js';
import type {
  EstadoMaterial,
  MaterialProyecto,
} from '../materiales/material-proyecto.entity.js';
import type {
  EstadoLiquidacion,
  LiquidacionNomina,
  TipoPeriodo,
} from '../nomina/nomina.entity.js';
import type { Proyecto } from '../proyectos/proyecto.entity.js';

export interface ProyectoRef {
  id: number;
  codigo: string;
  nombre: string;
}

export type AvanceSinCurva = Omit<AvanceProyecto, 'curva'>;

export interface LiquidacionResumen {
  id: number;
  tipoPeriodo: TipoPeriodo;
  anio: number;
  mes: number;
  quincena: 1 | 2 | null;
  fechaInicio: Fecha;
  fechaFin: Fecha;
  estado: EstadoLiquidacion;
  requiereRecalculo: boolean;
  totalDevengado: number;
  totalDeducciones: number;
  totalNeto: number;
  numeroTrabajadores: number;
  calculadaEn: Date | null;
  cerradaEn: Date | null;
  creadoEn: Date;
}

export interface AsignacionRespuesta {
  id: number;
  trabajadorId: number;
  proyectoId: number;
  fechaInicio: Fecha;
  fechaFin: Fecha | null;
  rolEnProyecto: string | null;
  vigente: boolean;
  trabajador: {
    id: number;
    nombre: string;
    numeroDocumento: string;
    cargo: string;
  };
  proyecto: ProyectoRef;
  creadoEn: Date;
}

export interface MaterialPendiente {
  id: number;
  proyectoId: number;
  nombre: string;
  descripcion: string | null;
  unidadMedida: string;
  cantidadSolicitada: number;
  cantidadEntregada: number;
  estado: EstadoMaterial;
  fechaSolicitud: Fecha;
  fechaRequerida: Fecha | null;
  fechaEntrega: Fecha | null;
  observaciones: string | null;
  solicitadoPor: { id: number; nombre: string };
  creadoEn: Date;
  actualizadoEn: Date;
  proyecto: ProyectoRef;
  vencido: boolean;
}

export interface HerramientaPendiente {
  id: number;
  proyectoId: number;
  nombre: string;
  codigo: string | null;
  cantidad: number;
  responsable: { id: number; nombre: string } | null;
  fechaAsignacion: Fecha;
  fechaDevolucionPrevista: Fecha | null;
  fechaDevolucion: Fecha | null;
  estado: EstadoHerramienta;
  observaciones: string | null;
  vencida: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  proyecto: ProyectoRef;
}

export const aProyectoRef = (p: Proyecto): ProyectoRef => ({
  id: p.id,
  codigo: p.codigo,
  nombre: p.nombre,
});

export const sinCurva = (a: AvanceProyecto): AvanceSinCurva => ({
  avanceReal: a.avanceReal,
  avancePlaneado: a.avancePlaneado,
  estado: a.estado,
  sumaPesos: a.sumaPesos,
});

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
    calculadaEn: l.calculadaEn,
    cerradaEn: l.cerradaEn,
    creadoEn: l.creadoEn,
  };
}

/** Requiere las relaciones `trabajador` y `proyecto`. */
export function aAsignacion(
  a: AsignacionProyecto,
  hoy: Fecha,
): AsignacionRespuesta {
  return {
    id: a.id,
    trabajadorId: a.trabajadorId,
    proyectoId: a.proyectoId,
    fechaInicio: a.fechaInicio,
    fechaFin: a.fechaFin,
    rolEnProyecto: a.rolEnProyecto,
    vigente: a.fechaInicio <= hoy && (a.fechaFin === null || a.fechaFin >= hoy),
    trabajador: {
      id: a.trabajador.id,
      nombre: a.trabajador.nombre,
      numeroDocumento: a.trabajador.numeroDocumento,
      cargo: a.trabajador.cargo,
    },
    proyecto: aProyectoRef(a.proyecto),
    creadoEn: a.creadoEn,
  };
}

/** Requiere las relaciones `proyecto` y `solicitadoPor`. */
export function aMaterialPendiente(
  m: MaterialProyecto,
  hoy: Fecha,
): MaterialPendiente {
  return {
    id: m.id,
    proyectoId: m.proyectoId,
    nombre: m.nombre,
    descripcion: m.descripcion,
    unidadMedida: m.unidadMedida,
    cantidadSolicitada: m.cantidadSolicitada,
    cantidadEntregada: m.cantidadEntregada,
    estado: m.estado,
    fechaSolicitud: m.fechaSolicitud,
    fechaRequerida: m.fechaRequerida,
    fechaEntrega: m.fechaEntrega,
    observaciones: m.observaciones,
    solicitadoPor: { id: m.solicitadoPor.id, nombre: m.solicitadoPor.nombre },
    creadoEn: m.creadoEn,
    actualizadoEn: m.actualizadoEn,
    proyecto: aProyectoRef(m.proyecto),
    vencido: m.fechaRequerida !== null && m.fechaRequerida < hoy,
  };
}

/** Requiere las relaciones `proyecto` y `responsable`. */
export function aHerramientaPendiente(
  h: HerramientaProyecto,
  hoy: Fecha,
): HerramientaPendiente {
  return {
    id: h.id,
    proyectoId: h.proyectoId,
    nombre: h.nombre,
    codigo: h.codigo,
    cantidad: h.cantidad,
    responsable: h.responsable
      ? { id: h.responsable.id, nombre: h.responsable.nombre }
      : null,
    fechaAsignacion: h.fechaAsignacion,
    fechaDevolucionPrevista: h.fechaDevolucionPrevista,
    fechaDevolucion: h.fechaDevolucion,
    estado: h.estado,
    observaciones: h.observaciones,
    vencida:
      h.estado === EstadoHerramienta.ASIGNADA &&
      h.fechaDevolucionPrevista !== null &&
      h.fechaDevolucionPrevista < hoy,
    creadoEn: h.creadoEn,
    actualizadoEn: h.actualizadoEn,
    proyecto: aProyectoRef(h.proyecto),
  };
}
