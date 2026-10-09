import { BadRequestException } from '@nestjs/common';
import {
  EstadoHerramienta,
  type HerramientaProyecto,
} from './herramienta-proyecto.entity.js';
import type { Fecha } from '../../common/utils/fechas.js';

export interface HerramientaRespuesta {
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
}

type DatosVencimiento = Pick<HerramientaProyecto, 'estado' | 'fechaDevolucionPrevista'>;

/** Sigue asignada después de la fecha prevista de devolución. */
export function estaVencida(herramienta: DatosVencimiento, hoy: Fecha): boolean {
  return (
    herramienta.estado === EstadoHerramienta.ASIGNADA &&
    herramienta.fechaDevolucionPrevista !== null &&
    herramienta.fechaDevolucionPrevista < hoy
  );
}

export function validarFechasHerramienta(
  fechaAsignacion: Fecha,
  fechaDevolucionPrevista: Fecha | null,
): void {
  if (fechaDevolucionPrevista !== null && fechaDevolucionPrevista < fechaAsignacion) {
    throw new BadRequestException(
      'La fecha de devolución prevista no puede ser anterior a la fecha de asignación',
    );
  }
}

/** Una herramienta devuelta siempre tiene fecha de devolución: si falta, se asume hoy. */
export function completarFechaDevolucion(
  estado: EstadoHerramienta,
  fechaDevolucion: Fecha | null,
  hoy: Fecha,
): Fecha | null {
  return fechaDevolucion ?? (estado === EstadoHerramienta.DEVUELTA ? hoy : null);
}

/** Usa la relación `responsable` si está cargada. */
export function aHerramientaRespuesta(
  herramienta: HerramientaProyecto,
  hoy: Fecha,
): HerramientaRespuesta {
  const { responsable } = herramienta;
  return {
    id: herramienta.id,
    proyectoId: herramienta.proyectoId,
    nombre: herramienta.nombre,
    codigo: herramienta.codigo,
    cantidad: herramienta.cantidad,
    responsable: responsable ? { id: responsable.id, nombre: responsable.nombre } : null,
    fechaAsignacion: herramienta.fechaAsignacion,
    fechaDevolucionPrevista: herramienta.fechaDevolucionPrevista,
    fechaDevolucion: herramienta.fechaDevolucion,
    estado: herramienta.estado,
    observaciones: herramienta.observaciones,
    vencida: estaVencida(herramienta, hoy),
    creadoEn: herramienta.creadoEn,
    actualizadoEn: herramienta.actualizadoEn,
  };
}
