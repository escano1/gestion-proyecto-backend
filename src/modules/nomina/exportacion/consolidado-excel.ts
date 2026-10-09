import ExcelJS from 'exceljs';
import { formatearFechaHoraColombia } from '../calculo/formato.js';
import { describirPeriodo } from '../calculo/periodo.js';
import {
  filaConsolidado,
  totalesConsolidado,
  type DatosConsolidado,
  type FilaConsolidado,
  type ValoresConsolidado,
} from './consolidado.js';

const FORMATO_MONEDA = '"$" #,##0;-"$" #,##0';
const FORMATO_MONEDA_DECIMALES = '"$" #,##0.00;-"$" #,##0.00';
const FORMATO_CANTIDAD = '#,##0.##';
const COLOR_ENCABEZADO = 'FF1F3A5F';
const COLOR_TOTALES = 'FFE8EDF3';
const FILA_ENCABEZADO = 4;

interface ColumnaExcel {
  titulo: string;
  clave: keyof FilaConsolidado;
  ancho: number;
  formato?: string;
}

const COLUMNAS: ColumnaExcel[] = [
  { titulo: 'Documento', clave: 'documento', ancho: 15 },
  { titulo: 'Nombre', clave: 'nombre', ancho: 32 },
  { titulo: 'Cargo', clave: 'cargo', ancho: 22 },
  { titulo: 'Días', clave: 'dias', ancho: 7, formato: '0' },
  { titulo: 'Salario', clave: 'salario', ancho: 15, formato: FORMATO_MONEDA },
  { titulo: 'Horas extra y recargos', clave: 'extrasYRecargos', ancho: 15, formato: FORMATO_MONEDA },
  { titulo: 'Auxilio de transporte', clave: 'auxilio', ancho: 14, formato: FORMATO_MONEDA },
  { titulo: 'Total devengado', clave: 'devengado', ancho: 16, formato: FORMATO_MONEDA },
  { titulo: 'Salud', clave: 'salud', ancho: 13, formato: FORMATO_MONEDA },
  { titulo: 'Pensión', clave: 'pension', ancho: 13, formato: FORMATO_MONEDA },
  { titulo: 'FSP', clave: 'fsp', ancho: 12, formato: FORMATO_MONEDA },
  { titulo: 'Retención en la fuente', clave: 'retencion', ancho: 14, formato: FORMATO_MONEDA },
  { titulo: 'Total deducciones', clave: 'deducciones', ancho: 16, formato: FORMATO_MONEDA },
  { titulo: 'Neto a pagar', clave: 'neto', ancho: 16, formato: FORMATO_MONEDA },
  { titulo: 'Alertas', clave: 'alertas', ancho: 60 },
];

const COLUMNAS_SUMABLES = new Set<keyof FilaConsolidado>([
  'salario',
  'extrasYRecargos',
  'auxilio',
  'devengado',
  'salud',
  'pension',
  'fsp',
  'retencion',
  'deducciones',
  'neto',
]);

const encabezadoRelleno: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: COLOR_ENCABEZADO },
};

function estilarEncabezado(fila: ExcelJS.Row): void {
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  fila.eachCell((celda) => {
    celda.fill = encabezadoRelleno;
  });
  fila.height = 32;
}

/** Libro con hoja "Consolidado" (una fila por trabajador y totales) y "Detalle" (una fila por concepto). */
export async function generarConsolidadoExcel(datos: DatosConsolidado): Promise<Buffer> {
  const { empresa, liquidacion, nominas, generadoEn } = datos;
  const libro = new ExcelJS.Workbook();
  libro.creator = empresa.nombre;
  libro.created = generadoEn;

  const hoja = libro.addWorksheet('Consolidado', {
    views: [{ state: 'frozen', ySplit: FILA_ENCABEZADO, xSplit: 2 }],
  });
  hoja.columns = COLUMNAS.map((c) => ({
    key: c.clave,
    width: c.ancho,
    ...(c.formato ? { style: { numFmt: c.formato } } : {}),
  }));

  hoja.mergeCells(1, 1, 1, COLUMNAS.length);
  hoja.getCell(1, 1).value = `${empresa.nombre}${empresa.nit ? ` — NIT ${empresa.nit}` : ''}`;
  hoja.getCell(1, 1).font = { bold: true, size: 14 };
  hoja.mergeCells(2, 1, 2, COLUMNAS.length);
  hoja.getCell(2, 1).value =
    `Nómina ${describirPeriodo(liquidacion)} · Liquidación #${liquidacion.id} · Estado: ${liquidacion.estado}` +
    `${liquidacion.requiereRecalculo ? ' (requiere recálculo)' : ''} · Generado: ${formatearFechaHoraColombia(generadoEn)}`;
  hoja.getCell(2, 1).font = { italic: true, color: { argb: 'FF555555' } };

  const encabezado = hoja.getRow(FILA_ENCABEZADO);
  encabezado.values = COLUMNAS.map((c) => c.titulo);
  estilarEncabezado(encabezado);

  const filas = nominas.map(filaConsolidado);
  for (const fila of filas) {
    const registro = hoja.addRow({ ...fila, alertas: fila.alertas.join('\n') });
    registro.getCell('alertas').alignment = { wrapText: true, vertical: 'top' };
  }

  const primeraFila = FILA_ENCABEZADO + 1;
  const ultimaFila = FILA_ENCABEZADO + filas.length;
  const totales = totalesConsolidado(filas);
  const filaTotales = hoja.addRow({});
  filaTotales.getCell('nombre').value = 'TOTALES';
  for (const columna of COLUMNAS) {
    if (!COLUMNAS_SUMABLES.has(columna.clave)) continue;
    const letra = hoja.getColumn(columna.clave).letter;
    filaTotales.getCell(columna.clave).value = filas.length
      ? {
          formula: `SUM(${letra}${primeraFila}:${letra}${ultimaFila})`,
          result: totales[columna.clave as keyof ValoresConsolidado],
        }
      : 0;
  }
  filaTotales.font = { bold: true };
  filaTotales.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTALES } };
    celda.border = { top: { style: 'thin' } };
  });

  if (filas.length) {
    hoja.autoFilter = {
      from: { row: FILA_ENCABEZADO, column: 1 },
      to: { row: ultimaFila, column: COLUMNAS.length },
    };
  }

  const detalle = libro.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] });
  detalle.columns = [
    { header: 'Documento', key: 'documento', width: 15 },
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Código', key: 'codigo', width: 16 },
    { header: 'Descripción', key: 'descripcion', width: 46 },
    { header: 'Cantidad', key: 'cantidad', width: 10, style: { numFmt: FORMATO_CANTIDAD } },
    { header: 'Valor unitario', key: 'valorUnitario', width: 15, style: { numFmt: FORMATO_MONEDA_DECIMALES } },
    { header: 'Valor', key: 'valor', width: 16, style: { numFmt: FORMATO_MONEDA } },
  ];
  estilarEncabezado(detalle.getRow(1));
  for (const nomina of nominas) {
    for (const concepto of nomina.conceptos) {
      detalle.addRow({
        documento: nomina.numeroDocumento,
        nombre: nomina.nombreTrabajador,
        tipo: concepto.tipo,
        codigo: concepto.codigo,
        descripcion: concepto.descripcion,
        cantidad: concepto.cantidad,
        valorUnitario: concepto.valorUnitario,
        valor: concepto.valor,
      });
    }
  }
  if (detalle.rowCount > 1) {
    detalle.autoFilter = { from: { row: 1, column: 1 }, to: { row: detalle.rowCount, column: 8 } };
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}
