import {
  dec,
  type Decimal,
  redondearPesos,
  sumar,
} from '../../common/utils/dinero.js';
import type { ResolutorParametros } from '../parametros/resolutor-parametros.js';
import type { FilaHorasAgregada } from '../registro-horas/consulta-horas.js';
import { type ClasificacionHora, factorCosto } from '../tipos-hora/recargos.js';
import { type DatosSalariales, valorHora } from '../trabajadores/valor-hora.js';

export interface FilaCosteada extends FilaHorasAgregada {
  esExtra: boolean;
  /** Pesos enteros: se redondea por fila para que cualquier agrupación sume lo mismo. */
  costo: Decimal;
}

export interface ResumenCostos {
  horas: number;
  horasExtra: number;
  costo: number;
}

/**
 * Costo directo de mano de obra (sin carga prestacional):
 * horas × valor hora × (1 + recargo), con el salario actual del trabajador y los
 * parámetros legales vigentes en la fecha trabajada.
 */
export function costearHoras(
  filas: FilaHorasAgregada[],
  trabajadores: ReadonlyMap<number, DatosSalariales>,
  tipos: ReadonlyMap<number, ClasificacionHora>,
  parametros: Pick<ResolutorParametros, 'en'>,
): FilaCosteada[] {
  return filas.map((fila) => {
    const trabajador = trabajadores.get(fila.trabajadorId);
    const tipo = tipos.get(fila.tipoHoraId);
    if (!trabajador)
      throw new Error(`Trabajador ${fila.trabajadorId} no cargado`);
    if (!tipo) throw new Error(`Tipo de hora ${fila.tipoHoraId} no cargado`);

    const p = parametros.en(fila.fecha);
    const costo = dec(fila.horas)
      .times(valorHora(trabajador, p))
      .times(factorCosto(tipo, p));
    return { ...fila, esExtra: tipo.esExtra, costo: redondearPesos(costo) };
  });
}

export function resumirCostos(filas: FilaCosteada[]): ResumenCostos {
  return {
    horas: sumar(filas.map((f) => dec(f.horas))).toNumber(),
    horasExtra: sumar(
      filas.filter((f) => f.esExtra).map((f) => dec(f.horas)),
    ).toNumber(),
    costo: sumar(filas.map((f) => f.costo)).toNumber(),
  };
}

export function agruparPor<K>(
  filas: FilaCosteada[],
  clave: (f: FilaCosteada) => K,
): Map<K, FilaCosteada[]> {
  const grupos = new Map<K, FilaCosteada[]>();
  for (const fila of filas) {
    const k = clave(fila);
    const grupo = grupos.get(k);
    if (grupo) grupo.push(fila);
    else grupos.set(k, [fila]);
  }
  return grupos;
}

/** Horas por tipo de hora (id del tipo → horas). */
export function horasPorTipo(filas: FilaCosteada[]): Map<number, number> {
  return new Map(
    [...agruparPor(filas, (f) => f.tipoHoraId)].map(([tipoHoraId, grupo]) => [
      tipoHoraId,
      resumirCostos(grupo).horas,
    ]),
  );
}
