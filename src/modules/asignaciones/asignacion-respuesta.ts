import type { Fecha } from '../../common/utils/fechas.js';
import type { AsignacionProyecto } from './asignacion-proyecto.entity.js';
import { contieneFecha } from './rangos-fechas.js';

/** Forma del contrato `Asignacion`, con trabajador y proyecto resumidos. */
export interface AsignacionRespuesta {
  id: number;
  trabajadorId: number;
  proyectoId: number;
  fechaInicio: string;
  fechaFin: string | null;
  rolEnProyecto: string | null;
  vigente: boolean;
  trabajador: { id: number; nombre: string; numeroDocumento: string; cargo: string };
  proyecto: { id: number; codigo: string; nombre: string };
  creadoEn: Date;
}

/** Requiere las relaciones `trabajador` y `proyecto` cargadas. */
export function aAsignacionRespuesta(a: AsignacionProyecto, hoy: Fecha): AsignacionRespuesta {
  return {
    id: a.id,
    trabajadorId: a.trabajadorId,
    proyectoId: a.proyectoId,
    fechaInicio: a.fechaInicio,
    fechaFin: a.fechaFin,
    rolEnProyecto: a.rolEnProyecto,
    vigente: contieneFecha({ inicio: a.fechaInicio, fin: a.fechaFin }, hoy),
    trabajador: {
      id: a.trabajador.id,
      nombre: a.trabajador.nombre,
      numeroDocumento: a.trabajador.numeroDocumento,
      cargo: a.trabajador.cargo,
    },
    proyecto: { id: a.proyecto.id, codigo: a.proyecto.codigo, nombre: a.proyecto.nombre },
    creadoEn: a.creadoEn,
  };
}
