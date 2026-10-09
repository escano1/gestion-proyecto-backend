import {
  formatearFechaHoraColombia,
  formatearNumero,
  formatearPesos,
} from '../calculo/formato.js';
import { describirPeriodo, type DatosPeriodo } from '../calculo/periodo.js';
import { TipoSalario } from '../../trabajadores/trabajador.entity.js';
import { EstadoLiquidacion, TipoConcepto } from '../nomina.entity.js';
import type { ConceptoDesprendible, Desprendible } from '../nomina.respuestas.js';
import type { DatosEmpresa } from './consolidado.js';
import {
  COLOR_PRIMARIO,
  COLOR_SECUNDARIO,
  COLOR_TEXTO,
  anchoUtil,
  asegurarEspacio,
  crearPdf,
  dibujarTabla,
  escribirPies,
  textoEnLinea,
  textoPdf,
  type ColumnaPdf,
  type DocumentoPdf,
} from './pdf.js';

export interface DatosDesprendiblePdf {
  empresa: DatosEmpresa;
  periodo: DatosPeriodo;
  desprendible: Desprendible;
  generadoEn: Date;
}

const MARGEN = 40;

/** Comprobante de pago de nómina de un trabajador (tamaño carta, vertical). */
export function generarDesprendiblePdf(datos: DatosDesprendiblePdf): Promise<Buffer> {
  const { empresa, periodo, desprendible: d, generadoEn } = datos;
  const { doc, contenido } = crearPdf({
    size: 'LETTER',
    margin: MARGEN,
    info: {
      Title: `Comprobante de pago - ${d.nombreTrabajador}`,
      Author: empresa.nombre,
      Subject: describirPeriodo(periodo),
    },
  });
  const ancho = anchoUtil(doc);

  let y = encabezado(doc, empresa, periodo, d, ancho);
  y = datosTrabajador(doc, d, y + 12, ancho);

  const columnas: ColumnaPdf[] = [
    { titulo: 'Concepto', ancho: ancho - 250 },
    { titulo: 'Cantidad', ancho: 70, alineacion: 'right' },
    { titulo: 'Valor unitario', ancho: 90, alineacion: 'right' },
    { titulo: 'Valor', ancho: 90, alineacion: 'right' },
  ];
  const filas = (tipo: TipoConcepto) =>
    d.conceptos.filter((c) => c.tipo === tipo).map(filaConcepto);

  y = titulo(doc, 'DEVENGADOS', y + 16);
  y = dibujarTabla(doc, y, columnas, filas(TipoConcepto.DEVENGADO), {
    cebra: true,
    totales: ['Total devengado', '', '', formatearPesos(d.totalDevengado)],
  });
  y = titulo(doc, 'DEDUCCIONES', y + 14);
  const deducciones = filas(TipoConcepto.DEDUCCION);
  y = dibujarTabla(doc, y, columnas, deducciones.length ? deducciones : [['Sin deducciones', '', '', '']], {
    cebra: true,
    totales: ['Total deducciones', '', '', formatearPesos(d.totalDeducciones)],
  });

  y = asegurarEspacio(doc, y + 14, 30);
  doc.rect(MARGEN, y, ancho, 28).fill(COLOR_PRIMARIO);
  doc.font('Helvetica-Bold').fillColor('#FFFFFF');
  textoEnLinea(doc, 'NETO A PAGAR', MARGEN + 10, y + 9, ancho / 2, 'left', 12);
  textoEnLinea(doc, formatearPesos(d.netoPagar), MARGEN + ancho / 2, y + 9, ancho / 2 - 10, 'right', 12);
  doc.font('Helvetica').fillColor(COLOR_TEXTO);

  escribirPies(
    doc,
    `Generado el ${formatearFechaHoraColombia(generadoEn)} (hora de Colombia) · Liquidación #${d.liquidacion.id}`,
  );
  doc.end();
  return contenido;
}

function encabezado(
  doc: DocumentoPdf,
  empresa: DatosEmpresa,
  periodo: DatosPeriodo,
  d: Desprendible,
  ancho: number,
): number {
  const mitad = ancho / 2;
  const derecha = MARGEN + mitad;
  doc.font('Helvetica-Bold').fillColor(COLOR_PRIMARIO);
  textoEnLinea(doc, empresa.nombre, MARGEN, MARGEN, mitad - 10, 'left', 13);
  doc.font('Helvetica').fillColor(COLOR_SECUNDARIO);
  textoEnLinea(doc, empresa.nit ? `NIT ${empresa.nit}` : '', MARGEN, MARGEN + 18, mitad - 10, 'left', 9);

  doc.font('Helvetica-Bold').fillColor(COLOR_TEXTO);
  textoEnLinea(doc, 'COMPROBANTE DE PAGO DE NÓMINA', derecha, MARGEN, mitad, 'right', 11);
  doc.font('Helvetica').fillColor(COLOR_SECUNDARIO);
  doc.fontSize(9).text(textoPdf(describirPeriodo(periodo)), derecha, MARGEN + 16, {
    width: mitad,
    align: 'right',
  });
  let y = Math.max(doc.y, MARGEN + 30) + 6;

  if (d.liquidacion.estado === EstadoLiquidacion.BORRADOR) {
    doc.font('Helvetica-Bold').fillColor('#B42318');
    textoEnLinea(
      doc,
      'LIQUIDACIÓN EN BORRADOR: los valores pueden cambiar hasta el cierre del periodo.',
      MARGEN,
      y,
      ancho,
      'left',
      8,
    );
    y += 14;
  }
  doc.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(1).strokeColor(COLOR_PRIMARIO).stroke();
  doc.font('Helvetica').fillColor(COLOR_TEXTO);
  return y;
}

function datosTrabajador(doc: DocumentoPdf, d: Desprendible, y: number, ancho: number): number {
  const esPorHora = d.tipoSalario === TipoSalario.POR_HORA;
  // Cada línea tiene uno (ancho completo) o dos pares etiqueta/valor.
  const lineas: [string, string][][] = [
    [['Trabajador', d.nombreTrabajador]],
    [['Cargo', d.cargo]],
    [
      ['Documento', `${d.tipoDocumento} ${d.numeroDocumento}`],
      ['Tipo de salario', esPorHora ? 'Por hora' : 'Mensual'],
    ],
    [
      ['Salario base', esPorHora ? `${formatearPesos(d.salarioBase)} por hora` : formatearPesos(d.salarioBase)],
      ['Valor hora ordinaria', formatearPesos(d.valorHora)],
    ],
    [
      ['Días laborados', formatearNumero(d.diasLaborados)],
      ['Ingreso base de cotización', formatearPesos(d.ibc)],
    ],
  ];
  const anchoEtiqueta = 110;
  const altoLinea = 15;
  const alto = lineas.length * altoLinea + 10;

  doc.rect(MARGEN, y, ancho, alto).lineWidth(0.5).strokeColor('#C8CED6').stroke();
  lineas.forEach((pares, fila) => {
    const anchoColumna = (ancho - 16) / pares.length;
    const yLinea = y + 6 + fila * altoLinea;
    pares.forEach(([etiqueta, valor], i) => {
      const x = MARGEN + 8 + i * anchoColumna;
      doc.font('Helvetica-Bold').fillColor(COLOR_SECUNDARIO);
      textoEnLinea(doc, etiqueta, x, yLinea, anchoEtiqueta - 6, 'left', 8);
      doc.font('Helvetica').fillColor(COLOR_TEXTO);
      textoEnLinea(doc, valor, x + anchoEtiqueta, yLinea, anchoColumna - anchoEtiqueta - 6, 'left', 8);
    });
  });
  return y + alto;
}

function titulo(doc: DocumentoPdf, texto: string, y: number): number {
  const yTitulo = asegurarEspacio(doc, y, 40);
  doc.font('Helvetica-Bold').fillColor(COLOR_PRIMARIO);
  textoEnLinea(doc, texto, MARGEN, yTitulo, 200, 'left', 10);
  doc.font('Helvetica').fillColor(COLOR_TEXTO);
  return yTitulo + 15;
}

function filaConcepto(c: ConceptoDesprendible): string[] {
  return [
    c.descripcion,
    c.cantidad === null ? '' : formatearNumero(c.cantidad),
    c.valorUnitario === null ? '' : formatearPesos(c.valorUnitario),
    formatearPesos(c.valor),
  ];
}
