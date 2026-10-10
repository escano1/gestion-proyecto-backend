import type { Fecha } from '../../common/utils/fechas.js';
import type { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import type {
  EstadoLiquidacion,
  LiquidacionNomina,
} from '../nomina/nomina.entity.js';
import type { Proyecto } from '../proyectos/proyecto.entity.js';

export interface ProyectoRef {
  id: number;
  codigo: string;
  nombre: string;
}

export interface LiquidacionResumen {
  id: number;
  anio: number;
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
  rolEnProyecto: string | null;
  trabajador: {
    id: number;
    nombre: string;
    numeroDocumento: string;
    cargo: string;
  };
  proyecto: ProyectoRef;
  creadoEn: Date;
}

export const aProyectoRef = (p: Proyecto): ProyectoRef => ({
  id: p.id,
  codigo: p.codigo,
  nombre: p.nombre,
});

export function aLiquidacionResumen(l: LiquidacionNomina): LiquidacionResumen {
  return {
    id: l.id,
    anio: l.anio,
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
export function aAsignacion(a: AsignacionProyecto): AsignacionRespuesta {
  return {
    id: a.id,
    trabajadorId: a.trabajadorId,
    proyectoId: a.proyectoId,
    rolEnProyecto: a.rolEnProyecto,
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

