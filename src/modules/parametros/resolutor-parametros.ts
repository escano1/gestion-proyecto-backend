import { BadRequestException } from '@nestjs/common';
import { Decimal } from '../../common/utils/dinero.js';
import type { Fecha } from '../../common/utils/fechas.js';
import { CodigoParametro } from './parametro-legal.entity.js';

/** Valores legales aplicables en una fecha concreta. */
export interface ParametrosVigentes {
  smmlv: Decimal;
  auxilioTransporte: Decimal;
  uvt: Decimal;
  jornadaMaximaSemanal: Decimal;
  recargoNocturno: Decimal;
  recargoExtraDiurna: Decimal;
  recargoExtraNocturna: Decimal;
  recargoDominicalFestivo: Decimal;
  aporteSaludEmpleado: Decimal;
  aportePensionEmpleado: Decimal;
  limiteHorasExtraDia: Decimal;
  limiteHorasExtraSemana: Decimal;
}

export interface FilaParametro {
  codigo: CodigoParametro;
  valor: number | string;
  vigenteDesde: Fecha;
}

export class ParametroNoVigenteError extends BadRequestException {
  constructor(codigo: CodigoParametro, fecha: Fecha) {
    super(
      `No hay un valor vigente del parámetro ${codigo} para la fecha ${fecha}. Regístrelo en Configuración > Parámetros legales.`,
    );
  }
}

/**
 * Resuelve el valor de cada parámetro según su vigencia. Es puro (sin BD):
 * se construye una vez con todas las filas y se consulta por fecha.
 */
export class ResolutorParametros {
  private readonly vigencias = new Map<
    CodigoParametro,
    { desde: Fecha; valor: Decimal }[]
  >();
  private readonly cache = new Map<Fecha, ParametrosVigentes>();

  constructor(filas: FilaParametro[]) {
    for (const fila of filas) {
      const lista = this.vigencias.get(fila.codigo) ?? [];
      lista.push({ desde: fila.vigenteDesde, valor: new Decimal(fila.valor) });
      this.vigencias.set(fila.codigo, lista);
    }
    for (const lista of this.vigencias.values()) {
      lista.sort((a, b) => (a.desde < b.desde ? 1 : -1)); // más reciente primero
    }
  }

  valor(codigo: CodigoParametro, fecha: Fecha): Decimal {
    const vigente = this.vigencias.get(codigo)?.find((v) => v.desde <= fecha);
    if (!vigente) throw new ParametroNoVigenteError(codigo, fecha);
    return vigente.valor;
  }

  en(fecha: Fecha): ParametrosVigentes {
    const enCache = this.cache.get(fecha);
    if (enCache) return enCache;
    const v = (codigo: CodigoParametro) => this.valor(codigo, fecha);
    const parametros: ParametrosVigentes = {
      smmlv: v(CodigoParametro.SMMLV),
      auxilioTransporte: v(CodigoParametro.AUXILIO_TRANSPORTE),
      uvt: v(CodigoParametro.UVT),
      jornadaMaximaSemanal: v(CodigoParametro.JORNADA_MAXIMA_SEMANAL),
      recargoNocturno: v(CodigoParametro.RECARGO_NOCTURNO),
      recargoExtraDiurna: v(CodigoParametro.RECARGO_EXTRA_DIURNA),
      recargoExtraNocturna: v(CodigoParametro.RECARGO_EXTRA_NOCTURNA),
      recargoDominicalFestivo: v(CodigoParametro.RECARGO_DOMINICAL_FESTIVO),
      aporteSaludEmpleado: v(CodigoParametro.APORTE_SALUD_EMPLEADO),
      aportePensionEmpleado: v(CodigoParametro.APORTE_PENSION_EMPLEADO),
      limiteHorasExtraDia: v(CodigoParametro.LIMITE_HORAS_EXTRA_DIA),
      limiteHorasExtraSemana: v(CodigoParametro.LIMITE_HORAS_EXTRA_SEMANA),
    };
    this.cache.set(fecha, parametros);
    return parametros;
  }
}

/** Convierte parámetros vigentes a números planos (respuestas API e instantáneas de nómina). */
export function parametrosANumeros(p: ParametrosVigentes): Record<string, number> {
  return Object.fromEntries(
    Object.entries(p).map(([clave, valor]) => [clave, (valor as Decimal).toNumber()]),
  );
}
