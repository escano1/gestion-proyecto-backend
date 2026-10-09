import { CERO, type Decimal } from '../../common/utils/dinero.js';
import {
  inicioSemana,
  sumarDias,
  type Fecha,
} from '../../common/utils/fechas.js';
import type { ParametrosVigentes } from '../parametros/resolutor-parametros.js';
import type { FilaHorasAgregada } from './consulta-horas.js';

export type TipoAlertaHoras = 'EXTRA_DIA' | 'EXTRA_SEMANA' | 'JORNADA_SEMANA';

/** Horas de un trabajador en un día (puede haber varias filas por día: una por proyecto). */
export interface HorasDiaTrabajador {
  trabajadorId: number;
  nombre: string;
  fecha: Fecha;
  horasExtra: number;
  horasNoExtra: number;
}

export interface AlertaHoras {
  trabajadorId: number;
  nombre: string;
  tipo: TipoAlertaHoras;
  /** La fecha (alerta diaria) o el lunes de la semana (alertas semanales). */
  periodo: Fecha;
  horas: number;
  limite: number;
  mensaje: string;
}

export interface FuenteParametros {
  en(fecha: Fecha): ParametrosVigentes;
}

interface Acumulado {
  trabajadorId: number;
  nombre: string;
  periodo: Fecha;
  extra: Decimal;
  noExtra: Decimal;
}

const ORDEN_TIPO: Record<TipoAlertaHoras, number> = {
  EXTRA_DIA: 0,
  EXTRA_SEMANA: 1,
  JORNADA_SEMANA: 2,
};

const formatear = (horas: Decimal): string =>
  String(horas.toDecimalPlaces(2).toNumber()).replace('.', ',');

function acumular(
  mapa: Map<string, Acumulado>,
  h: HorasDiaTrabajador,
  periodo: Fecha,
): void {
  const clave = `${h.trabajadorId}|${periodo}`;
  const actual = mapa.get(clave) ?? {
    trabajadorId: h.trabajadorId,
    nombre: h.nombre,
    periodo,
    extra: CERO,
    noExtra: CERO,
  };
  actual.extra = actual.extra.plus(h.horasExtra);
  actual.noExtra = actual.noExtra.plus(h.horasNoExtra);
  mapa.set(clave, actual);
}

function alerta(
  tipo: TipoAlertaHoras,
  a: Acumulado,
  horas: Decimal,
  limite: Decimal,
): AlertaHoras {
  const h = formatear(horas);
  const l = formatear(limite);
  const mensajes: Record<TipoAlertaHoras, string> = {
    EXTRA_DIA: `${a.nombre}: ${h} h extra el ${a.periodo} (límite ${l} h/día)`,
    EXTRA_SEMANA: `${a.nombre}: ${h} h extra en la semana del ${a.periodo} (límite ${l} h/semana)`,
    JORNADA_SEMANA: `${a.nombre}: ${h} h no extra en la semana del ${a.periodo} superan la jornada máxima de ${l} h (posibles horas extra no clasificadas)`,
  };
  return {
    trabajadorId: a.trabajadorId,
    nombre: a.nombre,
    tipo,
    periodo: a.periodo,
    horas: horas.toNumber(),
    limite: limite.toNumber(),
    mensaje: mensajes[tipo],
  };
}

/**
 * Compara las horas de cada trabajador con los límites legales vigentes:
 * extra por día (parámetros del día), extra y no extra por semana lunes–domingo
 * (parámetros del lunes). Solo se alerta cuando se supera el límite, no al igualarlo.
 */
export function evaluarAlertas(
  horasPorDia: HorasDiaTrabajador[],
  parametros: FuenteParametros,
): AlertaHoras[] {
  const dias = new Map<string, Acumulado>();
  const semanas = new Map<string, Acumulado>();
  for (const h of horasPorDia) {
    acumular(dias, h, h.fecha);
    acumular(semanas, h, inicioSemana(h.fecha));
  }

  const alertas: AlertaHoras[] = [];
  for (const dia of dias.values()) {
    if (dia.extra.isZero()) continue;
    const limite = parametros.en(dia.periodo).limiteHorasExtraDia;
    if (dia.extra.gt(limite))
      alertas.push(alerta('EXTRA_DIA', dia, dia.extra, limite));
  }
  for (const semana of semanas.values()) {
    if (semana.extra.isZero() && semana.noExtra.isZero()) continue;
    const p = parametros.en(semana.periodo);
    if (semana.extra.gt(p.limiteHorasExtraSemana)) {
      alertas.push(
        alerta('EXTRA_SEMANA', semana, semana.extra, p.limiteHorasExtraSemana),
      );
    }
    if (semana.noExtra.gt(p.jornadaMaximaSemanal)) {
      alertas.push(
        alerta(
          'JORNADA_SEMANA',
          semana,
          semana.noExtra,
          p.jornadaMaximaSemanal,
        ),
      );
    }
  }

  return alertas.sort(
    (a, b) =>
      a.nombre.localeCompare(b.nombre, 'es') ||
      a.trabajadorId - b.trabajadorId ||
      a.periodo.localeCompare(b.periodo) ||
      ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo],
  );
}

/** Convierte filas agregadas (por proyecto y tipo) a horas extra / no extra por día. */
export function aHorasPorDia(
  filas: FilaHorasAgregada[],
  tipos: ReadonlyMap<number, { esExtra: boolean }>,
  nombres: ReadonlyMap<number, string>,
): HorasDiaTrabajador[] {
  return filas.map((f) => {
    const tipo = tipos.get(f.tipoHoraId);
    if (!tipo) throw new Error(`Tipo de hora ${f.tipoHoraId} no cargado`);
    return {
      trabajadorId: f.trabajadorId,
      nombre: nombres.get(f.trabajadorId) ?? `Trabajador ${f.trabajadorId}`,
      fecha: f.fecha,
      horasExtra: tipo.esExtra ? f.horas : 0,
      horasNoExtra: tipo.esExtra ? 0 : f.horas,
    };
  });
}

/** Semanas completas (lunes a domingo) que cubren el rango, para evaluar los límites semanales. */
export function semanasQueCubren(
  desde: Fecha,
  hasta: Fecha,
): { desde: Fecha; hasta: Fecha } {
  return {
    desde: inicioSemana(desde),
    hasta: sumarDias(inicioSemana(hasta), 6),
  };
}

/** Alertas diarias dentro del rango y semanales cuya semana se solapa con él. */
export function alertasEnRango(
  alertas: AlertaHoras[],
  desde: Fecha,
  hasta: Fecha,
): AlertaHoras[] {
  return alertas.filter((a) =>
    a.tipo === 'EXTRA_DIA'
      ? a.periodo >= desde && a.periodo <= hasta
      : a.periodo <= hasta && sumarDias(a.periodo, 6) >= desde,
  );
}

/** Alertas relacionadas con los días modificados: las de ese día y las de su semana. */
export function alertasDeCambios(
  alertas: AlertaHoras[],
  cambios: { trabajadorId: number; fecha: Fecha }[],
): AlertaHoras[] {
  const dias = new Set(cambios.map((c) => `${c.trabajadorId}|${c.fecha}`));
  const semanas = new Set(
    cambios.map((c) => `${c.trabajadorId}|${inicioSemana(c.fecha)}`),
  );
  return alertas.filter((a) =>
    (a.tipo === 'EXTRA_DIA' ? dias : semanas).has(
      `${a.trabajadorId}|${a.periodo}`,
    ),
  );
}
