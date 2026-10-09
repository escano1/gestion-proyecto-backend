import { CERO, Decimal, sumar } from '../../../common/utils/dinero.js';
import { CODIGOS_CONCEPTO } from '../calculo/liquidador.js';
import { TipoConcepto } from '../nomina.entity.js';
import type { Desprendible, LiquidacionResumen } from '../nomina.respuestas.js';

export interface DatosEmpresa {
  nombre: string;
  nit: string;
}

export interface DatosConsolidado {
  empresa: DatosEmpresa;
  liquidacion: LiquidacionResumen;
  nominas: Desprendible[];
  generadoEn: Date;
}

export interface ValoresConsolidado {
  dias: number;
  salario: number;
  extrasYRecargos: number;
  auxilio: number;
  devengado: number;
  salud: number;
  pension: number;
  fsp: number;
  retencion: number;
  deducciones: number;
  neto: number;
}

export interface FilaConsolidado extends ValoresConsolidado {
  documento: string;
  nombre: string;
  cargo: string;
  alertas: string[];
}

/** Pago básico: salario mensual o, en salario por hora, las horas ordinarias diurnas. */
const CODIGOS_SALARIO = new Set<string>([CODIGOS_CONCEPTO.SALARIO, 'HORAS_ORD']);

function sumaPorCodigo(nomina: Desprendible, filtro: (codigo: string, tipo: TipoConcepto) => boolean) {
  return sumar(
    nomina.conceptos.filter((c) => filtro(c.codigo, c.tipo)).map((c) => new Decimal(c.valor)),
  ).toNumber();
}

export function filaConsolidado(n: Desprendible): FilaConsolidado {
  const codigo = (esperado: string) => (c: string) => c === esperado;
  return {
    documento: n.numeroDocumento,
    nombre: n.nombreTrabajador,
    cargo: n.cargo,
    dias: n.diasLaborados,
    salario: sumaPorCodigo(n, (c, t) => t === TipoConcepto.DEVENGADO && CODIGOS_SALARIO.has(c)),
    extrasYRecargos: sumaPorCodigo(
      n,
      (c, t) =>
        t === TipoConcepto.DEVENGADO && !CODIGOS_SALARIO.has(c) && c !== CODIGOS_CONCEPTO.AUX_TRANSPORTE,
    ),
    auxilio: sumaPorCodigo(n, codigo(CODIGOS_CONCEPTO.AUX_TRANSPORTE)),
    devengado: n.totalDevengado,
    salud: sumaPorCodigo(n, codigo(CODIGOS_CONCEPTO.SALUD)),
    pension: sumaPorCodigo(n, codigo(CODIGOS_CONCEPTO.PENSION)),
    fsp: sumaPorCodigo(n, codigo(CODIGOS_CONCEPTO.FSP)),
    retencion: sumaPorCodigo(n, codigo(CODIGOS_CONCEPTO.RETENCION)),
    deducciones: n.totalDeducciones,
    neto: n.netoPagar,
    alertas: n.alertas,
  };
}

export function totalesConsolidado(filas: ValoresConsolidado[]): ValoresConsolidado {
  const total = (clave: keyof ValoresConsolidado) =>
    filas.reduce((acc, f) => acc.plus(f[clave]), CERO).toNumber();
  return {
    dias: total('dias'),
    salario: total('salario'),
    extrasYRecargos: total('extrasYRecargos'),
    auxilio: total('auxilio'),
    devengado: total('devengado'),
    salud: total('salud'),
    pension: total('pension'),
    fsp: total('fsp'),
    retencion: total('retencion'),
    deducciones: total('deducciones'),
    neto: total('neto'),
  };
}
