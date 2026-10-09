import { formatearFechaHoraColombia, formatearNumero, formatearPesos } from '../calculo/formato.js';
import { describirPeriodo } from '../calculo/periodo.js';
import {
  filaConsolidado,
  totalesConsolidado,
  type DatosConsolidado,
  type ValoresConsolidado,
} from './consolidado.js';
import {
  COLOR_PRIMARIO,
  COLOR_SECUNDARIO,
  COLOR_TEXTO,
  anchoUtil,
  crearPdf,
  dibujarTabla,
  escribirPies,
  textoEnLinea,
  type ColumnaPdf,
} from './pdf.js';

const MARGEN = 30;

const COLUMNAS_VALORES: { titulo: string; clave: keyof ValoresConsolidado; ancho: number }[] = [
  { titulo: 'Días', clave: 'dias', ancho: 26 },
  { titulo: 'Salario', clave: 'salario', ancho: 58 },
  { titulo: 'Extras y recargos', clave: 'extrasYRecargos', ancho: 56 },
  { titulo: 'Auxilio transporte', clave: 'auxilio', ancho: 50 },
  { titulo: 'Total devengado', clave: 'devengado', ancho: 60 },
  { titulo: 'Salud', clave: 'salud', ancho: 48 },
  { titulo: 'Pensión', clave: 'pension', ancho: 48 },
  { titulo: 'FSP', clave: 'fsp', ancho: 42 },
  { titulo: 'Retención', clave: 'retencion', ancho: 50 },
  { titulo: 'Total deducciones', clave: 'deducciones', ancho: 56 },
  { titulo: 'Neto a pagar', clave: 'neto', ancho: 60 },
];

/** Consolidado de la liquidación en tamaño carta horizontal, con totales. */
export function generarConsolidadoPdf(datos: DatosConsolidado): Promise<Buffer> {
  const { empresa, liquidacion, generadoEn } = datos;
  const periodo = describirPeriodo(liquidacion);
  const { doc, contenido } = crearPdf({
    size: 'LETTER',
    layout: 'landscape',
    margin: MARGEN,
    info: { Title: `Nómina ${periodo}`, Author: empresa.nombre },
  });
  const ancho = anchoUtil(doc);

  doc.font('Helvetica-Bold').fillColor(COLOR_PRIMARIO);
  textoEnLinea(doc, empresa.nombre, MARGEN, MARGEN, ancho, 'left', 13);
  doc.font('Helvetica').fillColor(COLOR_SECUNDARIO);
  textoEnLinea(doc, empresa.nit ? `NIT ${empresa.nit}` : '', MARGEN, MARGEN + 17, ancho, 'left', 9);
  doc.font('Helvetica-Bold').fillColor(COLOR_TEXTO);
  textoEnLinea(doc, `Nómina consolidada — ${periodo}`, MARGEN, MARGEN + 32, ancho, 'left', 11);
  doc.font('Helvetica').fillColor(COLOR_SECUNDARIO);
  textoEnLinea(
    doc,
    `Liquidación #${liquidacion.id} · Estado: ${liquidacion.estado}` +
      `${liquidacion.requiereRecalculo ? ' (requiere recálculo)' : ''} · ` +
      `${liquidacion.numeroTrabajadores} trabajadores`,
    MARGEN,
    MARGEN + 48,
    ancho,
    'left',
    8,
  );
  doc.fillColor(COLOR_TEXTO);

  const anchoValores = COLUMNAS_VALORES.reduce((acc, c) => acc + c.ancho, 0);
  const anchoDocumento = 62;
  const columnas: ColumnaPdf[] = [
    { titulo: 'Documento', ancho: anchoDocumento },
    { titulo: 'Nombre', ancho: ancho - anchoDocumento - anchoValores },
    ...COLUMNAS_VALORES.map((c) => ({ titulo: c.titulo, ancho: c.ancho, alineacion: 'right' as const })),
  ];
  const filas = datos.nominas.map(filaConsolidado);
  const totales = totalesConsolidado(filas);
  const valores = (v: ValoresConsolidado) =>
    COLUMNAS_VALORES.map((c) => (c.clave === 'dias' ? formatearNumero(v.dias) : formatearPesos(v[c.clave])));

  dibujarTabla(
    doc,
    MARGEN + 66,
    columnas,
    filas.length
      ? filas.map((f) => [f.documento, f.nombre, ...valores(f)])
      : [['', 'Sin trabajadores liquidados', ...COLUMNAS_VALORES.map(() => '')]],
    {
      tamanoFuente: 7,
      altoFila: 14,
      altoEncabezado: 22,
      cebra: true,
      totales: ['', 'TOTALES', '', ...valores(totales).slice(1)],
    },
  );

  escribirPies(doc, `Generado el ${formatearFechaHoraColombia(generadoEn)} (hora de Colombia)`);
  doc.end();
  return contenido;
}
