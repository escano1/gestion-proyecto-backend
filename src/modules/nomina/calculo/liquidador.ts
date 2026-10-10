import {
  Decimal,
  dec,
  redondear2,
  redondearPesos,
  sumar,
  type ValorDecimal,
} from '../../../common/utils/dinero.js';
import { minFecha, sumarDias, type Fecha } from '../../../common/utils/fechas.js';
import type { UnidadParametro } from '../../parametros/catalogo-parametros.js';
import {
  parametrosANumeros,
  type ParametrosVigentes,
} from '../../parametros/resolutor-parametros.js';
import { factorPago, type ClasificacionHora } from '../../tipos-hora/recargos.js';
import { TipoJornada, TipoSalario } from '../../trabajadores/trabajador.entity.js';
import {
  salarioMensualEquivalente,
  valorHora,
  type DatosSalariales,
} from '../../trabajadores/valor-hora.js';
import { TipoConcepto } from '../nomina.entity.js';
import { calcularFsp } from './fondo-solidaridad.js';
import { formatearNumero, formatearPesos, formatearPorcentaje } from './formato.js';
import { DIAS_MES_COMERCIAL, type Periodo } from './periodo.js';
import { calcularRetencionFuente, type DetalleRetencion } from './retencion-fuente.js';

// Art. 18 Ley 100 de 1993 (mod. art. 5 Ley 797 de 2003): el IBC no puede superar 25 SMMLV.
const TOPE_IBC_SMMLV = 25;
// Ley 15 de 1959 y decreto anual del auxilio: se paga a quienes devenguen hasta 2 SMMLV.
const TOPE_AUXILIO_SMMLV = 2;

export const CODIGOS_CONCEPTO = {
  SALARIO: 'SALARIO',
  AUX_TRANSPORTE: 'AUX_TRANSPORTE',
  SALUD: 'SALUD',
  PENSION: 'PENSION',
  FSP: 'FSP',
  RETENCION: 'RETENCION',
} as const;

export type ParametrosEn = (fecha: Fecha) => ParametrosVigentes;

export interface TipoHoraNomina extends ClasificacionHora {
  id: number;
  codigo: string;
  nombre: string;
  orden: number;
}

export interface HoraTrabajada {
  fecha: Fecha;
  tipoHora: TipoHoraNomina;
  horas: ValorDecimal;
}

export interface TrabajadorNomina {
  tipoSalario: TipoSalario;
  /** Salario mensual (MENSUAL) o valor de la hora (POR_HORA). */
  salarioBase: number;
  tipoJornada: TipoJornada;
  horasSemanales: number | null;
  aplicaAuxilioTransporte: boolean;
}

export interface ConceptoLiquidado {
  tipo: TipoConcepto;
  codigo: string;
  descripcion: string;
  cantidad: Decimal | null;
  valorUnitario: Decimal | null;
  valor: Decimal;
  orden: number;
}

export interface LiquidacionTrabajador {
  diasLaborados: number;
  /** Días con los que se mensualiza el periodo (tope de IBC, FSP y retención). */
  diasBase: number;
  /** Valor de la hora ordinaria en la fecha de inicio del periodo. */
  valorHora: Decimal;
  ibc: Decimal;
  totalDevengado: Decimal;
  totalDeducciones: Decimal;
  netoPagar: Decimal;
  conceptos: ConceptoLiquidado[];
  alertas: string[];
  parametros: Record<string, number>;
  retencion: DetalleRetencion;
}

type ConceptoSinOrden = Omit<ConceptoLiquidado, 'orden'>;

/** Liquida un trabajador en un periodo. Función pura: no consulta la base de datos. */
export function liquidarTrabajador(
  trabajador: TrabajadorNomina,
  periodo: Periodo,
  horas: HoraTrabajada[],
  parametrosEn: ParametrosEn,
): LiquidacionTrabajador {
  const p = parametrosEn(periodo.fechaInicio);
  const datos = datosSalariales(trabajador);
  const alertas: string[] = [];

  const dentro = horas.filter((h) => dec(h.horas).gt(0));
  const esMensual = trabajador.tipoSalario === TipoSalario.MENSUAL;
  const diasBase = periodo.diasNominales;
  // Mensual: la semana completa. Por hora: los días distintos con horas registradas.
  const diasLaborados = esMensual
    ? diasBase
    : Math.min(new Set(dentro.map((h) => h.fecha)).size, diasBase);

  // Devengados salariales (base del IBC).
  const salariales: ConceptoSinOrden[] = [];
  if (esMensual && diasLaborados > 0) {
    salariales.push(conceptoSalario(trabajador.salarioBase, diasLaborados));
  }
  salariales.push(...lineasHoras(dentro, datos, parametrosEn));

  const devengados = [...salariales];
  const auxilio = conceptoAuxilio(trabajador, datos, diasLaborados, p);
  if (auxilio) devengados.push(auxilio);

  let ibc = sumar(salariales.map((c) => c.valor));
  const topeIbc = redondearPesos(
    p.smmlv.times(TOPE_IBC_SMMLV).times(diasBase).div(DIAS_MES_COMERCIAL),
  );
  if (ibc.gt(topeIbc)) {
    ibc = topeIbc;
    alertas.push(
      `IBC limitado al tope de ${TOPE_IBC_SMMLV} SMMLV proporcional a ${diasBase} días (${formatearPesos(topeIbc)}).`,
    );
  }

  const totalDevengado = sumar(devengados.map((c) => c.valor));
  const salud = redondearPesos(ibc.times(p.aporteSaludEmpleado));
  const pension = redondearPesos(ibc.times(p.aportePensionEmpleado));
  const fsp = calcularFsp({ ibc, diasBase, smmlv: p.smmlv });
  const retencion = calcularRetencionFuente({
    totalDevengado,
    aportesObligatorios: salud.plus(pension).plus(fsp.valor),
    diasBase,
    uvt: p.uvt,
  });

  const deducciones: ConceptoSinOrden[] = [];
  if (ibc.gt(0)) {
    deducciones.push(
      deduccion(CODIGOS_CONCEPTO.SALUD, `Aporte a salud (${formatearPorcentaje(p.aporteSaludEmpleado)})`, salud),
      deduccion(
        CODIGOS_CONCEPTO.PENSION,
        `Aporte a pensión (${formatearPorcentaje(p.aportePensionEmpleado)})`,
        pension,
      ),
    );
  }
  if (fsp.valor.gt(0)) {
    deducciones.push(
      deduccion(
        CODIGOS_CONCEPTO.FSP,
        `Fondo de Solidaridad Pensional (${formatearPorcentaje(fsp.porcentaje)})`,
        fsp.valor,
      ),
    );
  }
  if (retencion.valor.gt(0)) {
    deducciones.push(deduccion(CODIGOS_CONCEPTO.RETENCION, 'Retención en la fuente', retencion.valor));
  }

  const totalDeducciones = sumar(deducciones.map((c) => c.valor));
  const netoPagar = totalDevengado.minus(totalDeducciones);

  if (netoPagar.isNegative()) {
    alertas.push(`El neto a pagar es negativo (${formatearPesos(netoPagar)}).`);
  }
  if (
    esMensual &&
    trabajador.tipoJornada === TipoJornada.COMPLETA &&
    new Decimal(trabajador.salarioBase).lt(p.smmlv)
  ) {
    alertas.push(
      `Salario mensual (${formatearPesos(trabajador.salarioBase)}) inferior al SMMLV ` +
        `(${formatearPesos(p.smmlv)}) para jornada completa.`,
    );
  }
  const cambios = cambiosDeVigencia(periodo.fechaInicio, periodo.fechaFin, parametrosEn);
  if (cambios) alertas.push(cambios);

  return {
    diasLaborados,
    diasBase,
    valorHora: valorHora(datos, p),
    ibc,
    totalDevengado,
    totalDeducciones,
    netoPagar,
    conceptos: [...devengados, ...deducciones].map((c, i) => ({ ...c, orden: i + 1 })),
    alertas,
    parametros: parametrosANumeros(p),
    retencion,
  };
}

export interface TrabajadorALiquidar extends TrabajadorNomina {
  id: number;
}

export interface HoraDeTrabajador extends HoraTrabajada {
  trabajadorId: number;
}

export interface ResultadoNomina<T extends TrabajadorALiquidar> {
  nominas: { trabajador: T; liquidacion: LiquidacionTrabajador }[];
  totalDevengado: Decimal;
  totalDeducciones: Decimal;
  totalNeto: Decimal;
}

/** Liquida todos los trabajadores del periodo; excluye a quien quede sin devengados. */
export function liquidarNomina<T extends TrabajadorALiquidar>(
  periodo: Periodo,
  trabajadores: T[],
  horas: HoraDeTrabajador[],
  parametrosEn: ParametrosEn,
): ResultadoNomina<T> {
  const horasPorTrabajador = new Map<number, HoraTrabajada[]>();
  for (const hora of horas) {
    const lista = horasPorTrabajador.get(hora.trabajadorId) ?? [];
    lista.push(hora);
    horasPorTrabajador.set(hora.trabajadorId, lista);
  }

  const nominas = trabajadores
    .map((trabajador) => ({
      trabajador,
      liquidacion: liquidarTrabajador(
        trabajador,
        periodo,
        horasPorTrabajador.get(trabajador.id) ?? [],
        parametrosEn,
      ),
    }))
    .filter(({ liquidacion }) => !liquidacion.totalDevengado.isZero());

  return {
    nominas,
    totalDevengado: sumar(nominas.map((n) => n.liquidacion.totalDevengado)),
    totalDeducciones: sumar(nominas.map((n) => n.liquidacion.totalDeducciones)),
    totalNeto: sumar(nominas.map((n) => n.liquidacion.netoPagar)),
  };
}

function datosSalariales(t: TrabajadorNomina): DatosSalariales {
  return {
    tipoSalario: t.tipoSalario,
    salarioBase: t.salarioBase,
    horasSemanales: t.tipoJornada === TipoJornada.PARCIAL ? t.horasSemanales : null,
  };
}

function conceptoSalario(salarioBase: number, dias: number): ConceptoSinOrden {
  const salario = new Decimal(salarioBase);
  return {
    tipo: TipoConcepto.DEVENGADO,
    codigo: CODIGOS_CONCEPTO.SALARIO,
    descripcion: 'Salario básico',
    cantidad: new Decimal(dias),
    valorUnitario: redondear2(salario.div(DIAS_MES_COMERCIAL)),
    valor: redondearPesos(salario.times(dias).div(DIAS_MES_COMERCIAL)),
  };
}

interface GrupoHoras {
  tipoHora: TipoHoraNomina;
  factor: Decimal;
  valorUnitario: Decimal;
  horas: Decimal;
  primeraFecha: Fecha;
}

/**
 * Una línea por tipo de hora y valor unitario: el valor hora y los recargos son los
 * vigentes en la fecha trabajada, por lo que un mismo tipo puede generar varias líneas.
 */
function lineasHoras(
  horas: HoraTrabajada[],
  datos: DatosSalariales,
  parametrosEn: ParametrosEn,
): ConceptoSinOrden[] {
  const grupos = new Map<string, GrupoHoras>();
  for (const hora of horas) {
    const p = parametrosEn(hora.fecha);
    const factor = factorPago(hora.tipoHora, datos.tipoSalario, p);
    // Factor 0: horas ordinarias de un salario mensual, ya remuneradas en el salario.
    if (factor.isZero()) continue;
    const vh = valorHora(datos, p);
    const clave = `${hora.tipoHora.id}|${vh.toString()}|${factor.toString()}`;
    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.horas = grupo.horas.plus(dec(hora.horas));
      grupo.primeraFecha = minFecha(grupo.primeraFecha, hora.fecha);
    } else {
      grupos.set(clave, {
        tipoHora: hora.tipoHora,
        factor,
        valorUnitario: vh.times(factor),
        horas: dec(hora.horas),
        primeraFecha: hora.fecha,
      });
    }
  }

  return [...grupos.values()]
    .sort(
      (a, b) =>
        a.tipoHora.orden - b.tipoHora.orden ||
        a.primeraFecha.localeCompare(b.primeraFecha) ||
        a.tipoHora.codigo.localeCompare(b.tipoHora.codigo),
    )
    .map((g) => {
      const pagaHoraCompleta = g.tipoHora.esExtra || datos.tipoSalario === TipoSalario.POR_HORA;
      const porcentaje = formatearPorcentaje(g.factor);
      return {
        tipo: TipoConcepto.DEVENGADO,
        codigo: `${pagaHoraCompleta ? 'HORAS' : 'RECARGO'}_${g.tipoHora.codigo}`,
        descripcion: pagaHoraCompleta
          ? `${g.tipoHora.nombre} (${porcentaje})`
          : `Recargo ${minusculaInicial(g.tipoHora.nombre)} (${porcentaje})`,
        cantidad: g.horas,
        valorUnitario: redondear2(g.valorUnitario),
        valor: redondearPesos(g.horas.times(g.valorUnitario)),
      };
    });
}

/** No hace parte del IBC: solo se incorpora al salario para prestaciones sociales (art. 7 Ley 1 de 1963). */
function conceptoAuxilio(
  trabajador: TrabajadorNomina,
  datos: DatosSalariales,
  dias: number,
  p: ParametrosVigentes,
): ConceptoSinOrden | null {
  if (!trabajador.aplicaAuxilioTransporte || dias <= 0) return null;
  if (salarioMensualEquivalente(datos, p).gt(p.smmlv.times(TOPE_AUXILIO_SMMLV))) return null;
  return {
    tipo: TipoConcepto.DEVENGADO,
    codigo: CODIGOS_CONCEPTO.AUX_TRANSPORTE,
    descripcion: 'Auxilio de transporte',
    cantidad: new Decimal(dias),
    valorUnitario: redondear2(p.auxilioTransporte.div(DIAS_MES_COMERCIAL)),
    valor: redondearPesos(p.auxilioTransporte.times(dias).div(DIAS_MES_COMERCIAL)),
  };
}

function deduccion(codigo: string, descripcion: string, valor: Decimal): ConceptoSinOrden {
  return {
    tipo: TipoConcepto.DEDUCCION,
    codigo,
    descripcion,
    cantidad: null,
    valorUnitario: null,
    valor,
  };
}

const PARAMETROS_DE_LIQUIDACION: {
  clave: keyof ParametrosVigentes;
  nombre: string;
  unidad: UnidadParametro;
}[] = [
  { clave: 'smmlv', nombre: 'SMMLV', unidad: 'PESOS' },
  { clave: 'auxilioTransporte', nombre: 'auxilio de transporte', unidad: 'PESOS' },
  { clave: 'uvt', nombre: 'UVT', unidad: 'PESOS' },
  { clave: 'jornadaMaximaSemanal', nombre: 'jornada máxima semanal', unidad: 'HORAS' },
  { clave: 'recargoNocturno', nombre: 'recargo nocturno', unidad: 'FRACCION' },
  { clave: 'recargoExtraDiurna', nombre: 'recargo extra diurna', unidad: 'FRACCION' },
  { clave: 'recargoExtraNocturna', nombre: 'recargo extra nocturna', unidad: 'FRACCION' },
  { clave: 'recargoDominicalFestivo', nombre: 'recargo dominical/festivo', unidad: 'FRACCION' },
  { clave: 'aporteSaludEmpleado', nombre: 'aporte a salud', unidad: 'FRACCION' },
  { clave: 'aportePensionEmpleado', nombre: 'aporte a pensión', unidad: 'FRACCION' },
];

function formatearParametro(valor: Decimal, unidad: UnidadParametro): string {
  if (unidad === 'PESOS') return formatearPesos(valor);
  if (unidad === 'HORAS') return `${formatearNumero(valor)} h`;
  return formatearPorcentaje(valor);
}

/**
 * Describe los parámetros que cambian de vigencia entre el inicio y el fin del periodo
 * (los conceptos del periodo usan los vigentes al inicio); null si no cambian.
 */
function cambiosDeVigencia(
  inicioPeriodo: Fecha,
  hasta: Fecha,
  parametrosEn: ParametrosEn,
): string | null {
  const cambios: string[] = [];
  let anterior = parametrosEn(inicioPeriodo);
  for (let fecha = sumarDias(inicioPeriodo, 1); fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    const actual = parametrosEn(fecha);
    for (const { clave, nombre, unidad } of PARAMETROS_DE_LIQUIDACION) {
      if (!actual[clave].eq(anterior[clave])) {
        cambios.push(
          `${nombre} ${formatearParametro(anterior[clave], unidad)} → ` +
            `${formatearParametro(actual[clave], unidad)} desde ${fecha}`,
        );
      }
    }
    anterior = actual;
  }
  if (!cambios.length) return null;
  return (
    `Parámetros con vigencias distintas dentro del periodo: ${cambios.join('; ')}. ` +
    `Cada hora se liquidó con los valores de su fecha y los demás conceptos con los vigentes al ${inicioPeriodo}.`
  );
}

function minusculaInicial(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
