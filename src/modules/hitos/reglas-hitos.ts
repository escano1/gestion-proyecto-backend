import { BadRequestException } from '@nestjs/common';
import { EstadoHito, type HitoProyecto } from './hito-proyecto.entity.js';
import type { Fecha } from '../../common/utils/fechas.js';

export const SUMA_MAXIMA_PESOS = 100;

export interface HitoRespuesta {
  id: number;
  proyectoId: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  fechaPlaneada: Fecha;
  fechaReal: Fecha | null;
  peso: number;
  porcentajeAvance: number;
  estado: EstadoHito;
  creadoEn: Date;
  actualizadoEn: Date;
}

export function derivarEstadoHito(porcentajeAvance: number): EstadoHito {
  if (porcentajeAvance <= 0) return EstadoHito.PENDIENTE;
  if (porcentajeAvance >= 100) return EstadoHito.COMPLETADO;
  return EstadoHito.EN_PROGRESO;
}

/** Estado según el avance; un hito completado sin fecha real se da por terminado hoy. */
export function aplicarAvance(
  porcentajeAvance: number,
  fechaReal: Fecha | null,
  hoy: Fecha,
): { estado: EstadoHito; fechaReal: Fecha | null } {
  const estado = derivarEstadoHito(porcentajeAvance);
  return {
    estado,
    fechaReal: estado === EstadoHito.COMPLETADO ? (fechaReal ?? hoy) : fechaReal,
  };
}

/** Suma en centésimas: en coma flotante 33.33 + 33.33 + 33.34 no da exactamente 100. */
export function sumarPesos(pesos: number[]): number {
  return pesos.reduce((suma, peso) => suma + Math.round(peso * 100), 0) / 100;
}

export function validarSumaPesos(pesos: number[]): void {
  if (sumarPesos(pesos) > SUMA_MAXIMA_PESOS) {
    throw new BadRequestException('La suma de pesos de los hitos no puede superar 100');
  }
}

export function aHitoRespuesta(hito: HitoProyecto): HitoRespuesta {
  return {
    id: hito.id,
    proyectoId: hito.proyectoId,
    nombre: hito.nombre,
    descripcion: hito.descripcion,
    orden: hito.orden,
    fechaPlaneada: hito.fechaPlaneada,
    fechaReal: hito.fechaReal,
    peso: hito.peso,
    porcentajeAvance: hito.porcentajeAvance,
    estado: hito.estado,
    creadoEn: hito.creadoEn,
    actualizadoEn: hito.actualizadoEn,
  };
}
