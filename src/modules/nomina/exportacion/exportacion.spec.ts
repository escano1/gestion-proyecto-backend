import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { TipoDocumento, TipoSalario } from '../../trabajadores/trabajador.entity.js';
import { construirPeriodo } from '../calculo/periodo.js';
import {
  EstadoLiquidacion,
  TipoConcepto,
  TipoPeriodo,
} from '../nomina.entity.js';
import type { Desprendible, LiquidacionResumen } from '../nomina.respuestas.js';
import { filaConsolidado, totalesConsolidado, type DatosConsolidado } from './consolidado.js';
import { generarConsolidadoExcel } from './consolidado-excel.js';
import { generarConsolidadoPdf } from './consolidado-pdf.js';
import { generarDesprendiblePdf } from './desprendible-pdf.js';
import { textoPdf } from './pdf.js';

const periodo = construirPeriodo(TipoPeriodo.QUINCENAL, 2026, 10, 2);

const liquidacion: LiquidacionResumen = {
  id: 12,
  tipoPeriodo: periodo.tipoPeriodo,
  anio: periodo.anio,
  mes: periodo.mes,
  quincena: periodo.quincena,
  fechaInicio: periodo.fechaInicio,
  fechaFin: periodo.fechaFin,
  estado: EstadoLiquidacion.BORRADOR,
  requiereRecalculo: false,
  totalDevengado: 1_795_364,
  totalDeducciones: 133_864,
  totalNeto: 1_661_500,
  numeroTrabajadores: 2,
  calculadaEn: '2026-10-09T04:40:00.000Z',
  cerradaEn: null,
  creadoEn: '2026-10-09T04:40:00.000Z',
};

const ref = {
  id: liquidacion.id,
  tipoPeriodo: liquidacion.tipoPeriodo,
  fechaInicio: liquidacion.fechaInicio,
  fechaFin: liquidacion.fechaFin,
  estado: liquidacion.estado,
};

// Caso A de aceptación.
const mensual: Desprendible = {
  id: 1,
  trabajadorId: 7,
  nombreTrabajador: 'María Fernanda Peña Ñustes',
  tipoDocumento: TipoDocumento.CC,
  numeroDocumento: '1020304050',
  cargo: 'Ingeniera residente',
  tipoSalario: TipoSalario.MENSUAL,
  salarioBase: 2_100_000,
  valorHora: 10_000,
  diasLaborados: 15,
  ibc: 1_128_500,
  totalDevengado: 1_253_048,
  totalDeducciones: 90_280,
  netoPagar: 1_162_768,
  alertas: [],
  parametros: { smmlv: 1_750_905 },
  liquidacion: ref,
  conceptos: [
    { tipo: TipoConcepto.DEVENGADO, codigo: 'SALARIO', descripcion: 'Salario básico', cantidad: 15, valorUnitario: 70_000, valor: 1_050_000 },
    { tipo: TipoConcepto.DEVENGADO, codigo: 'RECARGO_NOC', descripcion: 'Recargo hora ordinaria nocturna (35 %)', cantidad: 3, valorUnitario: 3_500, valor: 10_500 },
    { tipo: TipoConcepto.DEVENGADO, codigo: 'HORAS_HED', descripcion: 'Hora extra diurna (125 %)', cantidad: 4, valorUnitario: 12_500, valor: 50_000 },
    { tipo: TipoConcepto.DEVENGADO, codigo: 'RECARGO_DOM', descripcion: 'Recargo hora dominical/festiva diurna (90 %)', cantidad: 2, valorUnitario: 9_000, valor: 18_000 },
    { tipo: TipoConcepto.DEVENGADO, codigo: 'AUX_TRANSPORTE', descripcion: 'Auxilio de transporte', cantidad: 15, valorUnitario: 8_303.17, valor: 124_548 },
    { tipo: TipoConcepto.DEDUCCION, codigo: 'SALUD', descripcion: 'Aporte a salud (4 %)', cantidad: null, valorUnitario: null, valor: 45_140 },
    { tipo: TipoConcepto.DEDUCCION, codigo: 'PENSION', descripcion: 'Aporte a pensión (4 %)', cantidad: null, valorUnitario: null, valor: 45_140 },
  ],
};

const porHora: Desprendible = {
  ...mensual,
  id: 2,
  trabajadorId: 9,
  nombreTrabajador: 'Juan Pérez',
  numeroDocumento: '80123456',
  cargo: 'Técnico electricista',
  tipoSalario: TipoSalario.POR_HORA,
  salarioBase: 12_000,
  valorHora: 12_000,
  diasLaborados: 5,
  ibc: 499_200,
  totalDevengado: 542_316,
  totalDeducciones: 43_584,
  netoPagar: 498_732,
  alertas: ['Parámetros con vigencias distintas: jornada máxima semanal 44 h → 42 h'],
  conceptos: [
    { tipo: TipoConcepto.DEVENGADO, codigo: 'HORAS_ORD', descripcion: 'Hora ordinaria diurna (100 %)', cantidad: 40, valorUnitario: 12_000, valor: 480_000 },
    { tipo: TipoConcepto.DEVENGADO, codigo: 'HORAS_HED', descripcion: 'Hora extra diurna (125 %)', cantidad: 1.28, valorUnitario: 15_000, valor: 19_200 },
    { tipo: TipoConcepto.DEVENGADO, codigo: 'AUX_TRANSPORTE', descripcion: 'Auxilio de transporte', cantidad: 5, valorUnitario: 8_303.17, valor: 43_116 },
    { tipo: TipoConcepto.DEDUCCION, codigo: 'SALUD', descripcion: 'Aporte a salud (4 %)', cantidad: null, valorUnitario: null, valor: 21_792 },
    { tipo: TipoConcepto.DEDUCCION, codigo: 'PENSION', descripcion: 'Aporte a pensión (4 %)', cantidad: null, valorUnitario: null, valor: 21_792 },
  ],
};

const datos: DatosConsolidado = {
  empresa: { nombre: 'Empresa de Ingeniería Eléctrica S.A.S.', nit: '900.000.000-0' },
  liquidacion,
  nominas: [mensual, porHora],
  generadoEn: new Date('2026-10-09T04:40:00Z'),
};

describe('consolidado', () => {
  it('clasifica los conceptos en las columnas del consolidado', () => {
    expect(filaConsolidado(mensual)).toMatchObject({
      documento: '1020304050',
      dias: 15,
      salario: 1_050_000,
      extrasYRecargos: 78_500,
      auxilio: 124_548,
      devengado: 1_253_048,
      salud: 45_140,
      pension: 45_140,
      fsp: 0,
      retencion: 0,
      deducciones: 90_280,
      neto: 1_162_768,
    });
    expect(filaConsolidado(porHora)).toMatchObject({ salario: 480_000, extrasYRecargos: 19_200 });
    expect(totalesConsolidado([filaConsolidado(mensual), filaConsolidado(porHora)])).toMatchObject({
      devengado: 1_795_364,
      deducciones: 133_864,
      neto: 1_661_500,
    });
  });
});

describe('exportaciones', () => {
  it('Excel consolidado: hojas Consolidado y Detalle con totales', async () => {
    const buffer = await generarConsolidadoExcel(datos);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const consolidado = libro.getWorksheet('Consolidado');
    const detalle = libro.getWorksheet('Detalle');
    expect(consolidado).toBeDefined();
    expect(detalle).toBeDefined();
    expect(consolidado?.getRow(4).getCell(1).value).toBe('Documento');
    expect(consolidado?.getRow(5).getCell(2).value).toBe('María Fernanda Peña Ñustes');
    const totales = consolidado?.getRow(7);
    expect(totales?.getCell(2).value).toBe('TOTALES');
    expect(totales?.getCell(14).value).toMatchObject({ formula: 'SUM(N5:N6)', result: 1_661_500 });
    expect(consolidado?.getColumn(14).numFmt).toContain('"$"');
    expect(detalle?.rowCount).toBe(1 + mensual.conceptos.length + porHora.conceptos.length);
  });

  it('PDF consolidado', async () => {
    const buffer = await generarConsolidadoPdf(datos);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('PDF consolidado con muchas filas pagina sin errores', async () => {
    const muchas = Array.from({ length: 120 }, (_, i) => ({ ...porHora, id: i + 10 }));
    const buffer = await generarConsolidadoPdf({ ...datos, nominas: muchas });
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
  });

  it('PDF consolidado sin trabajadores', async () => {
    const buffer = await generarConsolidadoPdf({ ...datos, nominas: [] });
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('PDF desprendible (comprobante de pago)', async () => {
    const buffer = await generarDesprendiblePdf({
      empresa: datos.empresa,
      periodo,
      desprendible: mensual,
      generadoEn: datos.generadoEn,
    });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('textoPdf reemplaza caracteres fuera de WinAnsi', () => {
    expect(textoPdf('44 h → 42 h · Ñandú — “ok” 漢')).toBe('44 h -> 42 h · Ñandú — “ok” ?');
  });
});
