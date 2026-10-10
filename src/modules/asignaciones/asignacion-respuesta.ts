import type { AsignacionProyecto } from './asignacion-proyecto.entity.js';

/** Forma del contrato `Asignacion`, con trabajador y proyecto resumidos. */
export interface AsignacionRespuesta {
  id: number;
  trabajadorId: number;
  proyectoId: number;
  rolEnProyecto: string | null;
  trabajador: { id: number; nombre: string; numeroDocumento: string; cargo: string };
  proyecto: { id: number; codigo: string; nombre: string };
  creadoEn: Date;
}

/** Requiere las relaciones `trabajador` y `proyecto` cargadas. */
export function aAsignacionRespuesta(a: AsignacionProyecto): AsignacionRespuesta {
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
    proyecto: { id: a.proyecto.id, codigo: a.proyecto.codigo, nombre: a.proyecto.nombre },
    creadoEn: a.creadoEn,
  };
}
