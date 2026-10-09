import type { EntityManager } from 'typeorm';
import type { Fecha } from '../../common/utils/fechas.js';

/** Horas sumadas por trabajador, proyecto, tipo de hora y fecha. */
export interface FilaHorasAgregada {
  trabajadorId: number;
  proyectoId: number;
  tipoHoraId: number;
  fecha: Fecha;
  horas: number;
}

export interface FiltroHorasAgregadas {
  desde?: Fecha;
  hasta?: Fecha;
  trabajadorIds?: number[];
  proyectoId?: number;
}

interface FilaCruda {
  trabajador_id: number;
  proyecto_id: number;
  tipo_hora_id: number;
  fecha: string;
  horas: string;
}

type EjecutorSql = Pick<EntityManager, 'query'>;

/** Un único SQL agregado; acepta `DataSource` o el `EntityManager` de una transacción. */
export async function consultarHorasAgregadas(
  ejecutor: EjecutorSql,
  filtro: FiltroHorasAgregadas,
): Promise<FilaHorasAgregada[]> {
  const condiciones: string[] = [];
  const parametros: unknown[] = [];
  const agregar = (condicion: string, valor: unknown) => {
    parametros.push(valor);
    condiciones.push(condicion.replace('?', `$${parametros.length}`));
  };

  if (filtro.desde) agregar('r.fecha >= ?::date', filtro.desde);
  if (filtro.hasta) agregar('r.fecha <= ?::date', filtro.hasta);
  if (filtro.trabajadorIds)
    agregar('r.trabajador_id = ANY(?::int[])', filtro.trabajadorIds);
  if (filtro.proyectoId) agregar('r.proyecto_id = ?', filtro.proyectoId);

  const filas = await ejecutor.query<FilaCruda[]>(
    `SELECT r.trabajador_id, r.proyecto_id, d.tipo_hora_id,
            to_char(r.fecha, 'YYYY-MM-DD') AS fecha, SUM(d.horas) AS horas
       FROM registros_horas r
       JOIN registros_horas_detalle d ON d.registro_id = r.id
      ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
      GROUP BY r.trabajador_id, r.proyecto_id, d.tipo_hora_id, r.fecha
      ORDER BY r.fecha, r.trabajador_id, r.proyecto_id, d.tipo_hora_id`,
    parametros,
  );

  return filas.map((f) => ({
    trabajadorId: Number(f.trabajador_id),
    proyectoId: Number(f.proyecto_id),
    tipoHoraId: Number(f.tipo_hora_id),
    fecha: f.fecha,
    horas: Number(f.horas),
  }));
}
