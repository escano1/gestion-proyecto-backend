import type { FindOptionsRelations } from 'typeorm';
import { dec, sumar } from '../../common/utils/dinero.js';
import type { CodigoTipoHora } from '../tipos-hora/tipo-hora.entity.js';
import type { RegistroHoras } from './registro-horas.entity.js';

/** Relaciones necesarias para construir la respuesta. */
export const RELACIONES_REGISTRO: FindOptionsRelations<RegistroHoras> = {
  trabajador: true,
  proyecto: true,
  detalles: { tipoHora: true },
  creadoPor: true,
  actualizadoPor: true,
};

/** Forma pública (contrato `RegistroHoras`): sin datos salariales del trabajador. */
export interface RegistroHorasRespuesta {
  id: number;
  fecha: string;
  observacion: string | null;
  trabajador: { id: number; nombre: string; numeroDocumento: string };
  proyecto: { id: number; codigo: string; nombre: string };
  detalles: {
    tipoHoraId: number;
    codigo: CodigoTipoHora;
    nombre: string;
    horas: number;
  }[];
  totalHoras: number;
  creadoPor: { id: number; nombre: string };
  actualizadoPor: { id: number; nombre: string } | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export function aRegistroHorasRespuesta(
  registro: RegistroHoras,
): RegistroHorasRespuesta {
  const detalles = [...registro.detalles]
    .sort((a, b) => a.tipoHora.orden - b.tipoHora.orden)
    .map((d) => ({
      tipoHoraId: d.tipoHoraId,
      codigo: d.tipoHora.codigo,
      nombre: d.tipoHora.nombre,
      horas: d.horas,
    }));
  return {
    id: registro.id,
    fecha: registro.fecha,
    observacion: registro.observacion,
    trabajador: {
      id: registro.trabajador.id,
      nombre: registro.trabajador.nombre,
      numeroDocumento: registro.trabajador.numeroDocumento,
    },
    proyecto: {
      id: registro.proyecto.id,
      codigo: registro.proyecto.codigo,
      nombre: registro.proyecto.nombre,
    },
    detalles,
    totalHoras: sumar(detalles.map((d) => dec(d.horas))).toNumber(),
    creadoPor: { id: registro.creadoPor.id, nombre: registro.creadoPor.nombre },
    actualizadoPor: registro.actualizadoPor
      ? {
          id: registro.actualizadoPor.id,
          nombre: registro.actualizadoPor.nombre,
        }
      : null,
    creadoEn: registro.creadoEn,
    actualizadoEn: registro.actualizadoEn,
  };
}
