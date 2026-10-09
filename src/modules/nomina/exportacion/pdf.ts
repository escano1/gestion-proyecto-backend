import PDFDocument from 'pdfkit';

export type DocumentoPdf = PDFKit.PDFDocument;
export type Alineacion = 'left' | 'right' | 'center';

export const COLOR_PRIMARIO = '#1F3A5F';
export const COLOR_TEXTO = '#111111';
export const COLOR_SECUNDARIO = '#555555';
const COLOR_CEBRA = '#F1F4F8';
const ALTO_PIE = 24;
const RELLENO_CELDA = 3;
const TAMANO_MINIMO = 5;
const REDUCCION_MAXIMA = 1.5;

// Caracteres de 0x80–0x9F que WinAnsi (codificación de las fuentes estándar) sí admite.
const EXTRAS_WIN_ANSI = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const REEMPLAZOS: Record<string, string> = { '→': '->', '−': '-', ' ': ' ', '≤': '<=', '≥': '>=' };

/** Las fuentes estándar (Helvetica) solo codifican WinAnsi: se reemplaza lo demás. */
export function textoPdf(texto: string): string {
  return texto.replace(/[^\n -ÿ]/gu, (c) => REEMPLAZOS[c] ?? (EXTRAS_WIN_ANSI.has(c) ? c : '?'));
}

/** Crea el documento y una promesa con el contenido completo al llamar `doc.end()`. */
export function crearPdf(opciones: PDFKit.PDFDocumentOptions): {
  doc: DocumentoPdf;
  contenido: Promise<Buffer>;
} {
  const doc = new PDFDocument({ bufferPages: true, ...opciones });
  const partes: Buffer[] = [];
  const contenido = new Promise<Buffer>((resolver, rechazar) => {
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);
  });
  doc.font('Helvetica').fillColor(COLOR_TEXTO);
  return { doc, contenido };
}

export function anchoUtil(doc: DocumentoPdf): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function limiteInferior(doc: DocumentoPdf): number {
  return doc.page.height - doc.page.margins.bottom - ALTO_PIE;
}

/** Agrega página si no caben `alto` puntos; devuelve la `y` donde continuar. */
export function asegurarEspacio(doc: DocumentoPdf, y: number, alto: number): number {
  if (y + alto <= limiteInferior(doc)) return y;
  doc.addPage();
  return doc.page.margins.top;
}

/** Texto en una línea dentro de `ancho`: reduce la fuente y, si aún no cabe, recorta con "…". */
export function textoEnLinea(
  doc: DocumentoPdf,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  alineacion: Alineacion = 'left',
  tamano = 8,
): void {
  let contenido = textoPdf(texto);
  let tamanoActual = tamano;
  const tamanoMinimo = Math.max(TAMANO_MINIMO, tamano - REDUCCION_MAXIMA);
  doc.fontSize(tamanoActual);
  while (doc.widthOfString(contenido) > ancho && tamanoActual > tamanoMinimo) {
    tamanoActual -= 0.5;
    doc.fontSize(tamanoActual);
  }
  if (doc.widthOfString(contenido) > ancho) {
    while (contenido.length > 1 && doc.widthOfString(`${contenido}…`) > ancho) {
      contenido = contenido.slice(0, -1);
    }
    contenido = `${contenido}…`;
  }
  doc.text(contenido, x, y + (tamano - tamanoActual) / 2, {
    width: ancho,
    align: alineacion,
    lineBreak: false,
  });
  doc.fontSize(tamano);
}

export interface ColumnaPdf {
  titulo: string;
  ancho: number;
  alineacion?: Alineacion;
}

export interface OpcionesTabla {
  x?: number;
  tamanoFuente?: number;
  altoFila?: number;
  altoEncabezado?: number;
  cebra?: boolean;
  totales?: string[];
}

/** Dibuja una tabla con encabezado repetido en cada página; devuelve la `y` final. */
export function dibujarTabla(
  doc: DocumentoPdf,
  y: number,
  columnas: ColumnaPdf[],
  filas: string[][],
  opciones: OpcionesTabla = {},
): number {
  const tamano = opciones.tamanoFuente ?? 8;
  const altoFila = opciones.altoFila ?? tamano + 8;
  const altoEncabezado = opciones.altoEncabezado ?? altoFila;
  const x = opciones.x ?? doc.page.margins.left;
  const anchoTotal = columnas.reduce((acc, c) => acc + c.ancho, 0);
  const posiciones = columnas.map((_, i) =>
    columnas.slice(0, i).reduce((acc, c) => acc + c.ancho, x),
  );

  const escribirFila = (valores: string[], yFila: number, alto: number) => {
    valores.forEach((valor, i) => {
      const columna = columnas[i];
      if (!columna) return;
      textoEnLinea(
        doc,
        valor,
        posiciones[i] + RELLENO_CELDA,
        yFila + (alto - tamano) / 2,
        columna.ancho - 2 * RELLENO_CELDA,
        columna.alineacion,
        tamano,
      );
    });
  };

  const encabezado = (yEncabezado: number): number => {
    doc.rect(x, yEncabezado, anchoTotal, altoEncabezado).fill(COLOR_PRIMARIO);
    doc.font('Helvetica-Bold').fillColor('#FFFFFF').fontSize(tamano);
    columnas.forEach((c, i) => {
      const anchoTexto = c.ancho - 2 * RELLENO_CELDA;
      const altoTexto = doc.heightOfString(textoPdf(c.titulo), { width: anchoTexto });
      doc.text(textoPdf(c.titulo), posiciones[i] + RELLENO_CELDA, yEncabezado + (altoEncabezado - altoTexto) / 2, {
        width: anchoTexto,
        align: c.alineacion ?? 'left',
      });
    });
    doc.font('Helvetica').fillColor(COLOR_TEXTO);
    return yEncabezado + altoEncabezado;
  };

  let yActual = encabezado(asegurarEspacio(doc, y, altoEncabezado + altoFila));
  filas.forEach((fila, indice) => {
    const yNueva = asegurarEspacio(doc, yActual, altoFila);
    if (yNueva !== yActual) yActual = encabezado(yNueva);
    if (opciones.cebra && indice % 2 === 1) {
      doc.rect(x, yActual, anchoTotal, altoFila).fill(COLOR_CEBRA);
      doc.fillColor(COLOR_TEXTO);
    }
    escribirFila(fila, yActual, altoFila);
    yActual += altoFila;
  });

  if (opciones.totales) {
    const yNueva = asegurarEspacio(doc, yActual, altoFila);
    if (yNueva !== yActual) yActual = encabezado(yNueva);
    doc.moveTo(x, yActual).lineTo(x + anchoTotal, yActual).lineWidth(0.8).strokeColor(COLOR_PRIMARIO).stroke();
    doc.font('Helvetica-Bold');
    escribirFila(opciones.totales, yActual, altoFila);
    doc.font('Helvetica');
    yActual += altoFila;
  }
  return yActual;
}

/** Pie con texto y "Página n de m" en todas las páginas (requiere `bufferPages`). */
export function escribirPies(doc: DocumentoPdf, texto: string): void {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const margenInferior = doc.page.margins.bottom;
    // Sin margen inferior temporal para que pdfkit no cree una página al escribir en el pie.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - margenInferior - ALTO_PIE / 2;
    const x = doc.page.margins.left;
    const ancho = anchoUtil(doc);
    doc.font('Helvetica').fontSize(7).fillColor(COLOR_SECUNDARIO);
    doc.text(textoPdf(texto), x, y, { width: ancho * 0.8, lineBreak: false });
    doc.text(`Página ${i - start + 1} de ${count}`, x, y, { width: ancho, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margenInferior;
  }
  doc.fillColor(COLOR_TEXTO);
}
