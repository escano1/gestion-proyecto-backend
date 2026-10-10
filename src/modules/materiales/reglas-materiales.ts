import { dec, redondearPesos } from '../../common/utils/dinero.js';
import type { MaterialProyecto } from './material-proyecto.entity.js';

export interface MaterialRespuesta {
  id: number;
  proyectoId: number;
  nombre: string;
  unidadMedida: string;
  cantidadSolicitada: number;
  precioUnitario: number;
  /** Pesos enteros: `precioUnitario × cantidadSolicitada`. */
  costo: number;
  creadoEn: Date;
  actualizadoEn: Date;
}

type DatosCosto = Pick<MaterialProyecto, 'precioUnitario' | 'cantidadSolicitada'>;

export const costoMaterial = (m: DatosCosto): number =>
  redondearPesos(dec(m.precioUnitario).times(m.cantidadSolicitada)).toNumber();

export function aMaterialRespuesta(material: MaterialProyecto): MaterialRespuesta {
  return {
    id: material.id,
    proyectoId: material.proyectoId,
    nombre: material.nombre,
    unidadMedida: material.unidadMedida,
    cantidadSolicitada: material.cantidadSolicitada,
    precioUnitario: material.precioUnitario,
    costo: costoMaterial(material),
    creadoEn: material.creadoEn,
    actualizadoEn: material.actualizadoEn,
  };
}
