import { EstadoMaterial, type MaterialProyecto } from './material-proyecto.entity.js';
import type { Fecha } from '../../common/utils/fechas.js';

export interface MaterialRespuesta {
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
}

const ESTADOS_CON_ENTREGA: ReadonlySet<EstadoMaterial> = new Set([
  EstadoMaterial.ENTREGADO,
  EstadoMaterial.INSTALADO,
]);

/** Un material entregado o instalado siempre tiene fecha de entrega: si falta, se asume hoy. */
export function completarFechaEntrega(
  estado: EstadoMaterial,
  fechaEntrega: Fecha | null,
  hoy: Fecha,
): Fecha | null {
  return fechaEntrega ?? (ESTADOS_CON_ENTREGA.has(estado) ? hoy : null);
}

/** Requiere la relación `solicitadoPor` cargada. */
export function aMaterialRespuesta(material: MaterialProyecto): MaterialRespuesta {
  return {
    id: material.id,
    proyectoId: material.proyectoId,
    nombre: material.nombre,
    descripcion: material.descripcion,
    unidadMedida: material.unidadMedida,
    cantidadSolicitada: material.cantidadSolicitada,
    cantidadEntregada: material.cantidadEntregada,
    estado: material.estado,
    fechaSolicitud: material.fechaSolicitud,
    fechaRequerida: material.fechaRequerida,
    fechaEntrega: material.fechaEntrega,
    observaciones: material.observaciones,
    solicitadoPor: { id: material.solicitadoPor.id, nombre: material.solicitadoPor.nombre },
    creadoEn: material.creadoEn,
    actualizadoEn: material.actualizadoEn,
  };
}
