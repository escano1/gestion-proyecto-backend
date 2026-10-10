import { describe, expect, it } from 'vitest';
import type { Fecha } from '../../../common/utils/fechas.js';
import { CodigoParametro } from '../../parametros/parametro-legal.entity.js';
import {
  ResolutorParametros,
  type FilaParametro,
} from '../../parametros/resolutor-parametros.js';
import { TipoJornada, TipoSalario } from '../../trabajadores/trabajador.entity.js';
import { TipoConcepto } from '../nomina.entity.js';
import {
  liquidarNomina,
  liquidarTrabajador,
  type HoraTrabajada,
  type LiquidacionTrabajador,
  type TipoHoraNomina,
  type TrabajadorNomina,
} from './liquidador.js';
import { construirPeriodo } from './periodo.js';

// Vigencias sembradas en la base de datos (migración DatosIniciales).
const VIGENCIAS: [CodigoParametro, number, Fecha][] = [
  [CodigoParametro.SMMLV, 1423500, '2025-01-01'],
  [CodigoParametro.SMMLV, 1750905, '2026-01-01'],
  [CodigoParametro.AUXILIO_TRANSPORTE, 200000, '2025-01-01'],
  [CodigoParametro.AUXILIO_TRANSPORTE, 249095, '2026-01-01'],
  [CodigoParametro.UVT, 49799, '2025-01-01'],
  [CodigoParametro.UVT, 52374, '2026-01-01'],
  [CodigoParametro.JORNADA_MAXIMA_SEMANAL, 46, '2024-07-15'],
  [CodigoParametro.JORNADA_MAXIMA_SEMANAL, 44, '2025-07-15'],
  [CodigoParametro.JORNADA_MAXIMA_SEMANAL, 42, '2026-07-15'],
  [CodigoParametro.RECARGO_NOCTURNO, 0.35, '2024-01-01'],
  [CodigoParametro.RECARGO_EXTRA_DIURNA, 0.25, '2024-01-01'],
  [CodigoParametro.RECARGO_EXTRA_NOCTURNA, 0.75, '2024-01-01'],
  [CodigoParametro.RECARGO_DOMINICAL_FESTIVO, 0.75, '2024-01-01'],
  [CodigoParametro.RECARGO_DOMINICAL_FESTIVO, 0.8, '2025-07-01'],
  [CodigoParametro.RECARGO_DOMINICAL_FESTIVO, 0.9, '2026-07-01'],
  [CodigoParametro.RECARGO_DOMINICAL_FESTIVO, 1.0, '2027-07-01'],
  [CodigoParametro.APORTE_SALUD_EMPLEADO, 0.04, '2024-01-01'],
  [CodigoParametro.APORTE_PENSION_EMPLEADO, 0.04, '2024-01-01'],
  [CodigoParametro.LIMITE_HORAS_EXTRA_DIA, 2, '2024-01-01'],
  [CodigoParametro.LIMITE_HORAS_EXTRA_SEMANA, 12, '2024-01-01'],
];
const resolutor = new ResolutorParametros(
  VIGENCIAS.map(([codigo, valor, vigenteDesde]): FilaParametro => ({ codigo, valor, vigenteDesde })),
);
const parametrosEn = (fecha: Fecha) => resolutor.en(fecha);

const tipo = (
  id: number,
  codigo: string,
  nombre: string,
  esExtra: boolean,
  esNocturna: boolean,
  esDominicalFestiva: boolean,
): TipoHoraNomina => ({ id, codigo, nombre, esExtra, esNocturna, esDominicalFestiva, orden: id });

const ORD = tipo(1, 'ORD', 'Hora ordinaria diurna', false, false, false);
const NOC = tipo(2, 'NOC', 'Hora ordinaria nocturna', false, true, false);
const HED = tipo(3, 'HED', 'Hora extra diurna', true, false, false);
const HEN = tipo(4, 'HEN', 'Hora extra nocturna', true, true, false);
const DOM = tipo(5, 'DOM', 'Hora dominical/festiva diurna', false, false, true);
const HEDD = tipo(7, 'HEDD', 'Hora extra dominical/festiva diurna', true, false, true);
const HEDN = tipo(8, 'HEDN', 'Hora extra dominical/festiva nocturna', true, true, true);

const hora = (fecha: Fecha, tipoHora: TipoHoraNomina, horas: number): HoraTrabajada => ({
  fecha,
  tipoHora,
  horas,
});

const mensual = (salarioBase: number, cambios: Partial<TrabajadorNomina> = {}): TrabajadorNomina => ({
  tipoSalario: TipoSalario.MENSUAL,
  salarioBase,
  tipoJornada: TipoJornada.COMPLETA,
  horasSemanales: null,
  aplicaAuxilioTransporte: true,
  ...cambios,
});

const porHora = (valorHora: number, cambios: Partial<TrabajadorNomina> = {}): TrabajadorNomina => ({
  ...mensual(valorHora, cambios),
  tipoSalario: TipoSalario.POR_HORA,
  ...cambios,
});

const SEMANA = construirPeriodo('2026-10-12'); // 12 al 18 de octubre de 2026
const SEMANA_CRUCE = construirPeriodo('2026-10-26'); // 26 de octubre al 1 de noviembre

/** Conceptos como `{ CODIGO: valor }` para comparar de forma legible. */
function valores(l: LiquidacionTrabajador): Record<string, number> {
  return Object.fromEntries(l.conceptos.map((c) => [c.codigo, c.valor.toNumber()]));
}

function concepto(l: LiquidacionTrabajador, codigo: string) {
  const c = l.conceptos.find((x) => x.codigo === codigo);
  if (!c) throw new Error(`No existe el concepto ${codigo}`);
  return {
    tipo: c.tipo,
    descripcion: c.descripcion,
    cantidad: c.cantidad?.toNumber() ?? null,
    valorUnitario: c.valorUnitario?.toNumber() ?? null,
    valor: c.valor.toNumber(),
  };
}

describe('liquidarTrabajador — casos de aceptación', () => {
  it('A) mensual 2.100.000, semana con nocturnas, dominicales y extras', () => {
    const l = liquidarTrabajador(
      mensual(2_100_000),
      SEMANA,
      [hora('2026-10-12', NOC, 3), hora('2026-10-12', DOM, 2), hora('2026-10-12', HED, 4)],
      parametrosEn,
    );

    expect(l.valorHora.toNumber()).toBe(10_000);
    expect(l.diasLaborados).toBe(7);
    expect(l.diasBase).toBe(7);
    expect(valores(l)).toEqual({
      SALARIO: 490_000,
      RECARGO_NOC: 10_500,
      HORAS_HED: 50_000,
      RECARGO_DOM: 18_000,
      AUX_TRANSPORTE: 58_122,
      SALUD: 22_740,
      PENSION: 22_740,
    });
    expect(l.conceptos.map((c) => c.codigo)).toEqual([
      'SALARIO',
      'RECARGO_NOC',
      'HORAS_HED',
      'RECARGO_DOM',
      'AUX_TRANSPORTE',
      'SALUD',
      'PENSION',
    ]);
    expect(l.conceptos.map((c) => c.orden)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(concepto(l, 'SALARIO')).toEqual({
      tipo: TipoConcepto.DEVENGADO,
      descripcion: 'Salario básico',
      cantidad: 7,
      valorUnitario: 70_000,
      valor: 490_000,
    });
    expect(concepto(l, 'RECARGO_NOC')).toMatchObject({
      descripcion: 'Recargo hora ordinaria nocturna (35 %)',
      cantidad: 3,
      valorUnitario: 3_500,
    });
    expect(concepto(l, 'RECARGO_DOM')).toMatchObject({
      descripcion: 'Recargo hora dominical/festiva diurna (90 %)',
      cantidad: 2,
      valorUnitario: 9_000,
    });
    expect(concepto(l, 'HORAS_HED')).toMatchObject({
      descripcion: 'Hora extra diurna (125 %)',
      cantidad: 4,
      valorUnitario: 12_500,
    });
    expect(concepto(l, 'SALUD')).toMatchObject({
      tipo: TipoConcepto.DEDUCCION,
      descripcion: 'Aporte a salud (4 %)',
      cantidad: null,
      valorUnitario: null,
    });
    expect(l.ibc.toNumber()).toBe(568_500);
    expect(l.retencion.valor.toNumber()).toBe(0);
    expect(l.totalDevengado.toNumber()).toBe(626_622);
    expect(l.totalDeducciones.toNumber()).toBe(45_480);
    expect(l.netoPagar.toNumber()).toBe(581_142);
    expect(l.alertas).toEqual([]);
    expect(l.parametros).toMatchObject({
      smmlv: 1_750_905,
      auxilioTransporte: 249_095,
      uvt: 52_374,
      jornadaMaximaSemanal: 42,
      recargoDominicalFestivo: 0.9,
    });
  });

  it('B) mensual 12.000.000: FSP 1 % y retención en la fuente', () => {
    const l = liquidarTrabajador(mensual(12_000_000), SEMANA, [], parametrosEn);

    expect(l.diasLaborados).toBe(7);
    expect(valores(l)).toEqual({
      SALARIO: 2_800_000,
      SALUD: 112_000,
      PENSION: 112_000,
      FSP: 28_000,
      RETENCION: 144_000,
    });
    expect(concepto(l, 'FSP').descripcion).toBe('Fondo de Solidaridad Pensional (1 %)');
    expect(l.retencion.baseGravable.toNumber()).toBe(8_190_000);
    expect(l.retencion.baseUvt.toDecimalPlaces(4).toNumber()).toBe(156.3753);
    expect(l.totalDeducciones.toNumber()).toBe(396_000);
    expect(l.netoPagar.toNumber()).toBe(2_404_000);
  });

  it('C) por hora 12.000: 40 h ORD + 4 h NOC en 5 días de la semana', () => {
    const fechas = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
    const horas = [
      ...fechas.map((f) => hora(f, ORD, 8)),
      ...fechas.slice(0, 4).map((f) => hora(f, NOC, 1)),
    ];
    const l = liquidarTrabajador(porHora(12_000), SEMANA, horas, parametrosEn);

    expect(l.diasLaborados).toBe(5);
    expect(l.diasBase).toBe(7);
    expect(valores(l)).toEqual({
      HORAS_ORD: 480_000,
      HORAS_NOC: 64_800,
      AUX_TRANSPORTE: 41_516,
      SALUD: 21_792,
      PENSION: 21_792,
    });
    expect(concepto(l, 'HORAS_ORD')).toMatchObject({
      descripcion: 'Hora ordinaria diurna (100 %)',
      cantidad: 40,
      valorUnitario: 12_000,
    });
    expect(concepto(l, 'HORAS_NOC')).toMatchObject({
      descripcion: 'Hora ordinaria nocturna (135 %)',
      cantidad: 4,
      valorUnitario: 16_200,
    });
    expect(l.ibc.toNumber()).toBe(544_800);
    expect(l.netoPagar.toNumber()).toBe(542_732);
    expect(l.valorHora.toNumber()).toBe(12_000);
  });
});

describe('liquidarTrabajador — recargos y valor hora por fecha', () => {
  it('extra dominical diurna (215 %) y nocturna (265 %) con dominical 0,90', () => {
    const l = liquidarTrabajador(
      mensual(2_100_000),
      SEMANA,
      [hora('2026-10-12', HEDD, 2), hora('2026-10-12', HEDN, 1)],
      parametrosEn,
    );
    expect(concepto(l, 'HORAS_HEDD')).toMatchObject({
      descripcion: 'Hora extra dominical/festiva diurna (215 %)',
      cantidad: 2,
      valorUnitario: 21_500,
      valor: 43_000,
    });
    expect(concepto(l, 'HORAS_HEDN')).toMatchObject({
      descripcion: 'Hora extra dominical/festiva nocturna (265 %)',
      cantidad: 1,
      valorUnitario: 26_500,
      valor: 26_500,
    });
  });

  it('extra nocturna no acumula el recargo nocturno (175 %)', () => {
    const l = liquidarTrabajador(mensual(2_100_000), SEMANA, [hora('2026-10-12', HEN, 2)], parametrosEn);
    expect(concepto(l, 'HORAS_HEN')).toMatchObject({ valorUnitario: 17_500, valor: 35_000 });
  });

  it('recargo dominical 0,80 en junio de 2026 (jornada de 44 h)', () => {
    const junio = construirPeriodo('2026-06-01');
    const l = liquidarTrabajador(mensual(2_200_000), junio, [hora('2026-06-01', DOM, 2)], parametrosEn);
    expect(l.valorHora.toNumber()).toBe(10_000);
    expect(concepto(l, 'RECARGO_DOM')).toEqual({
      tipo: TipoConcepto.DEVENGADO,
      descripcion: 'Recargo hora dominical/festiva diurna (80 %)',
      cantidad: 2,
      valorUnitario: 8_000,
      valor: 16_000,
    });
  });

  it('las horas ordinarias diurnas de un salario mensual no generan línea', () => {
    const l = liquidarTrabajador(mensual(2_100_000), SEMANA, [hora('2026-10-12', ORD, 42)], parametrosEn);
    expect(l.conceptos.some((c) => c.codigo.endsWith('_ORD'))).toBe(false);
    expect(l.ibc.toNumber()).toBe(490_000);
  });

  it('cambio de valor hora el 2026-07-15: dos líneas del mismo tipo en la semana del cambio', () => {
    const semana = construirPeriodo('2026-07-13');
    const l = liquidarTrabajador(
      mensual(2_310_000),
      semana,
      [hora('2026-07-15', HED, 2), hora('2026-07-14', HED, 2), hora('2026-07-13', HED, 1)],
      parametrosEn,
    );
    const extras = l.conceptos.filter((c) => c.codigo === 'HORAS_HED');
    // Antes del 15: 2.310.000 / 220 = 10.500; desde el 15: 2.310.000 / 210 = 11.000.
    expect(
      extras.map((c) => [c.cantidad?.toNumber(), c.valorUnitario?.toNumber(), c.valor.toNumber()]),
    ).toEqual([
      [3, 13_125, 39_375],
      [2, 13_750, 27_500],
    ]);
    expect(l.valorHora.toNumber()).toBe(10_500);
    expect(l.parametros.jornadaMaximaSemanal).toBe(44);
    expect(l.alertas).toHaveLength(1);
    expect(l.alertas[0]).toContain('jornada máxima semanal 44 h → 42 h desde 2026-07-15');
  });

  it('valor hora con decimales: valor unitario a 2 decimales y valor sobre el exacto', () => {
    const junio = construirPeriodo('2026-06-15');
    const l = liquidarTrabajador(mensual(2_100_000), junio, [hora('2026-06-15', DOM, 3)], parametrosEn);
    // 2.100.000 / 220 = 9.545,4545… × 0,80 = 7.636,3636…; 3 h = 22.909,09 → 22.909.
    expect(concepto(l, 'RECARGO_DOM')).toMatchObject({ valorUnitario: 7_636.36, valor: 22_909 });
  });
});

describe('liquidarTrabajador — días, auxilio e IBC', () => {
  it('mensual sin horas: salario y auxilio de la semana completa', () => {
    const l = liquidarTrabajador(mensual(1_800_000), SEMANA, [], parametrosEn);
    expect(l.diasLaborados).toBe(7);
    expect(l.diasBase).toBe(7);
    expect(valores(l)).toMatchObject({ SALARIO: 420_000, AUX_TRANSPORTE: 58_122 });
  });

  it('por hora sin horas: 0 días y sin conceptos; liquidarNomina lo excluye', () => {
    const l = liquidarTrabajador(porHora(12_000), SEMANA, [], parametrosEn);
    expect(l.diasLaborados).toBe(0);
    expect(l.conceptos).toEqual([]);
    expect(l.totalDevengado.toNumber()).toBe(0);

    const resultado = liquidarNomina(
      SEMANA,
      [
        { id: 2, ...mensual(1_800_000) },
        { id: 3, ...porHora(12_000) },
      ],
      [],
      parametrosEn,
    );
    expect(resultado.nominas.map((n) => n.trabajador.id)).toEqual([2]);
    expect(resultado.totalNeto.toNumber()).toBe(resultado.nominas[0].liquidacion.netoPagar.toNumber());
  });

  it('liquidarNomina reparte las horas por trabajador y suma totales', () => {
    const resultado = liquidarNomina(
      SEMANA,
      [
        { id: 7, ...mensual(2_100_000) },
        { id: 9, ...porHora(12_000) },
      ],
      [
        { trabajadorId: 7, ...hora('2026-10-12', NOC, 3) },
        { trabajadorId: 9, ...hora('2026-10-12', ORD, 8) },
      ],
      parametrosEn,
    );
    const [a, b] = resultado.nominas.map((n) => n.liquidacion);
    expect(valores(a).RECARGO_NOC).toBe(10_500);
    expect(valores(b).HORAS_ORD).toBe(96_000);
    expect(resultado.totalDevengado.toNumber()).toBe(
      a.totalDevengado.plus(b.totalDevengado).toNumber(),
    );
    expect(resultado.totalDeducciones.toNumber()).toBe(
      a.totalDeducciones.plus(b.totalDeducciones).toNumber(),
    );
  });

  it('las horas en 0 no cuentan como semana trabajada', () => {
    const l = liquidarTrabajador(porHora(12_000), SEMANA, [hora('2026-10-12', ORD, 0)], parametrosEn);
    expect(l.diasLaborados).toBe(0);
  });

  it('sin auxilio de transporte por encima de 2 SMMLV o si no aplica', () => {
    const sobreTope = liquidarTrabajador(mensual(3_501_811), SEMANA, [], parametrosEn);
    const enTope = liquidarTrabajador(mensual(3_501_810), SEMANA, [], parametrosEn);
    const noAplica = liquidarTrabajador(
      mensual(1_800_000, { aplicaAuxilioTransporte: false }),
      SEMANA,
      [],
      parametrosEn,
    );
    expect(valores(sobreTope).AUX_TRANSPORTE).toBeUndefined();
    expect(valores(enTope).AUX_TRANSPORTE).toBe(58_122);
    expect(valores(noAplica).AUX_TRANSPORTE).toBeUndefined();
  });

  it('por hora: el tope de auxilio usa el salario mensual equivalente (valor hora × 210)', () => {
    // 16.676 × 210 = 3.501.960 > 3.501.810.
    const l = liquidarTrabajador(porHora(16_676), SEMANA, [hora('2026-10-12', ORD, 8)], parametrosEn);
    expect(valores(l).AUX_TRANSPORTE).toBeUndefined();
  });

  it('jornada parcial: valor hora con las horas semanales pactadas', () => {
    const l = liquidarTrabajador(
      mensual(1_200_000, { tipoJornada: TipoJornada.PARCIAL, horasSemanales: 24 }),
      SEMANA,
      [hora('2026-10-12', HED, 1)],
      parametrosEn,
    );
    // 1.200.000 / (24 × 5) = 10.000.
    expect(l.valorHora.toNumber()).toBe(10_000);
    expect(valores(l).HORAS_HED).toBe(12_500);
    expect(l.alertas).toEqual([]);
  });

  it('tope de IBC en 25 SMMLV proporcional a la semana, con alerta', () => {
    const l = liquidarTrabajador(mensual(50_000_000), SEMANA, [], parametrosEn);
    // 25 × 1.750.905 × 7 / 30 = 10.213.612,5 → 10.213.613.
    expect(l.ibc.toNumber()).toBe(10_213_613);
    expect(valores(l)).toMatchObject({
      SALARIO: 11_666_667,
      SALUD: 408_545,
      PENSION: 408_545,
      FSP: 204_272,
    });
    expect(l.alertas).toEqual([
      'IBC limitado al tope de 25 SMMLV proporcional a 7 días ($ 10.213.613).',
    ]);
  });
});

describe('liquidarTrabajador — alertas', () => {
  it('salario mensual de jornada completa inferior al SMMLV', () => {
    const l = liquidarTrabajador(mensual(1_500_000), SEMANA, [], parametrosEn);
    expect(l.alertas).toEqual([
      'Salario mensual ($ 1.500.000) inferior al SMMLV ($ 1.750.905) para jornada completa.',
    ]);
  });

  it('no alerta salario bajo el SMMLV en jornada parcial', () => {
    const l = liquidarTrabajador(
      mensual(900_000, { tipoJornada: TipoJornada.PARCIAL, horasSemanales: 21 }),
      SEMANA,
      [],
      parametrosEn,
    );
    expect(l.alertas).toEqual([]);
  });

  it('neto negativo', () => {
    // Con parámetros legales reales no ocurre; se fuerza con un aporte de salud ficticio del 150 %.
    const resolutorAlto = new ResolutorParametros([
      ...VIGENCIAS.filter(([c]) => c !== CodigoParametro.APORTE_SALUD_EMPLEADO).map(
        ([codigo, valor, vigenteDesde]): FilaParametro => ({ codigo, valor, vigenteDesde }),
      ),
      { codigo: CodigoParametro.APORTE_SALUD_EMPLEADO, valor: 1.5, vigenteDesde: '2024-01-01' },
    ]);
    const l = liquidarTrabajador(
      mensual(2_000_000, { aplicaAuxilioTransporte: false }),
      SEMANA,
      [],
      (f) => resolutorAlto.en(f),
    );
    // 466.667 − 700.001 (salud) − 18.667 (pensión).
    expect(l.netoPagar.toNumber()).toBe(-252_001);
    expect(l.alertas).toContain('El neto a pagar es negativo (-$ 252.001).');
  });

  it('vigencias distintas: solo se alertan los cambios dentro de la semana', () => {
    const conCambio = liquidarTrabajador(mensual(2_310_000), construirPeriodo('2026-07-13'), [], parametrosEn);
    expect(conCambio.alertas).toHaveLength(1);
    expect(conCambio.alertas[0]).not.toContain('recargo dominical');
    expect(conCambio.alertas[0]).toContain('jornada máxima semanal');

    const sinCambio = liquidarTrabajador(mensual(2_310_000), construirPeriodo('2026-07-06'), [], parametrosEn);
    expect(sinCambio.alertas).toEqual([]);
  });
});

describe('liquidarTrabajador — semana que cruza de mes', () => {
  it('prorratea el salario mensual por los 7 días de la semana', () => {
    const l = liquidarTrabajador(mensual(2_100_000), SEMANA_CRUCE, [], parametrosEn);
    expect(l.diasLaborados).toBe(7);
    expect(l.diasBase).toBe(7);
    // 2.100.000 × 7 / 30 = 490.000.
    expect(concepto(l, 'SALARIO').valor).toBe(490_000);
  });

  it('por hora: los días laborados son las fechas distintas con horas', () => {
    const horas = [hora('2026-10-30', ORD, 8), hora('2026-10-30', NOC, 2), hora('2026-11-01', ORD, 8)];
    const l = liquidarTrabajador(porHora(12_000), SEMANA_CRUCE, horas, parametrosEn);
    expect(l.diasLaborados).toBe(2);
  });
});
