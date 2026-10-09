import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export const CAMPO_ARCHIVOS = 'archivos';
export const MAX_ADJUNTOS_POR_ENTRADA = 5;
export const TAMANO_MAXIMO_MB = 10;
export const TAMANO_MAXIMO_BYTES = TAMANO_MAXIMO_MB * 1024 * 1024;
const LONGITUD_MAXIMA_NOMBRE = 255;

/** Subconjunto de `Express.Multer.File` (almacenamiento en memoria) que usa la bitácora. */
export interface ArchivoCargado {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface AdjuntoNuevo {
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  contenido: Buffer;
}

interface TipoArchivo {
  etiqueta: string;
  /** Imágenes y PDF se muestran en el navegador; el resto se descarga. */
  enLinea: boolean;
  /** El MIME lo declara el cliente: se contrasta con los primeros bytes del archivo. */
  firmaValida: (contenido: Buffer) => boolean;
}

const empiezaCon = (contenido: Buffer, firma: string | number[], desde = 0): boolean => {
  const bytes = typeof firma === 'string' ? Buffer.from(firma, 'latin1') : Buffer.from(firma);
  return contenido.subarray(desde, desde + bytes.length).equals(bytes);
};
const esZip = (contenido: Buffer) => empiezaCon(contenido, [0x50, 0x4b, 0x03, 0x04]);

const TIPOS_PERMITIDOS = new Map<string, TipoArchivo>([
  ['image/jpeg', { etiqueta: 'JPG', enLinea: true, firmaValida: (c) => empiezaCon(c, [0xff, 0xd8, 0xff]) }],
  [
    'image/png',
    {
      etiqueta: 'PNG',
      enLinea: true,
      firmaValida: (c) => empiezaCon(c, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    },
  ],
  [
    'image/webp',
    {
      etiqueta: 'WEBP',
      enLinea: true,
      firmaValida: (c) => empiezaCon(c, 'RIFF') && empiezaCon(c, 'WEBP', 8),
    },
  ],
  // La especificación PDF tolera bytes previos a la cabecera dentro del primer KB.
  ['application/pdf', { etiqueta: 'PDF', enLinea: true, firmaValida: (c) => c.subarray(0, 1024).includes('%PDF-') }],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    { etiqueta: 'DOCX', enLinea: false, firmaValida: esZip },
  ],
  [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    { etiqueta: 'XLSX', enLinea: false, firmaValida: esZip },
  ],
]);

const ETIQUETAS_PERMITIDAS = [...TIPOS_PERMITIDOS.values()].map((t) => t.etiqueta).join(', ');

export function esTipoPermitido(mimeType: string): boolean {
  return TIPOS_PERMITIDOS.has(mimeType);
}

export function mensajeTipoNoPermitido(nombreArchivo: string): string {
  return `El archivo "${nombreArchivo}" no es de un tipo permitido (${ETIQUETAS_PERMITIDAS})`;
}

export function validarArchivo({ originalname, mimetype, buffer }: ArchivoCargado): void {
  const tipo = TIPOS_PERMITIDOS.get(mimetype);
  if (!tipo) throw new BadRequestException(mensajeTipoNoPermitido(originalname));
  if (buffer.length === 0) {
    throw new BadRequestException(`El archivo "${originalname}" está vacío`);
  }
  if (buffer.length > TAMANO_MAXIMO_BYTES) {
    throw new BadRequestException(
      `El archivo "${originalname}" supera el tamaño máximo de ${TAMANO_MAXIMO_MB} MB`,
    );
  }
  if (!tipo.firmaValida(buffer)) {
    throw new BadRequestException(
      `El contenido de "${originalname}" no corresponde a un archivo ${tipo.etiqueta}`,
    );
  }
}

export function validarCantidadAdjuntos(existentes: number, nuevos: number): void {
  if (existentes + nuevos > MAX_ADJUNTOS_POR_ENTRADA) {
    throw new BadRequestException(
      `Una entrada de bitácora admite máximo ${MAX_ADJUNTOS_POR_ENTRADA} adjuntos (ya tiene ${existentes})`,
    );
  }
}

/** Quita rutas y caracteres de control y recorta a 255 caracteres conservando la extensión. */
export function normalizarNombreArchivo(nombre: string): string {
  // Por puntos de código: PostgreSQL mide varchar(255) en caracteres, no en unidades UTF-16.
  const caracteres = Array.from(nombre.normalize('NFC'), (c) => {
    const codigo = c.codePointAt(0) ?? 0;
    return codigo < 0x20 || codigo === 0x7f || c === '/' || c === '\\' ? '_' : c;
  });
  const simbolos = Array.from(caracteres.join('').trim() || 'archivo');
  if (simbolos.length <= LONGITUD_MAXIMA_NOMBRE) return simbolos.join('');

  const punto = simbolos.lastIndexOf('.');
  const extension = punto > 0 && simbolos.length - punto <= 10 ? simbolos.slice(punto) : [];
  return simbolos
    .slice(0, LONGITUD_MAXIMA_NOMBRE - extension.length)
    .concat(extension)
    .join('');
}

export function prepararAdjuntos(archivos: ArchivoCargado[]): AdjuntoNuevo[] {
  return archivos.map((archivo) => {
    validarArchivo(archivo);
    return {
      nombreArchivo: normalizarNombreArchivo(archivo.originalname),
      mimeType: archivo.mimetype,
      tamanoBytes: archivo.buffer.length,
      contenido: archivo.buffer,
    };
  });
}

/** RFC 5987: además de lo que escapa encodeURIComponent, `'()*` no son attr-char. */
function codificarRfc5987(texto: string): string {
  return encodeURIComponent(texto).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Nombre ASCII de respaldo para clientes que no entienden `filename*`. */
function nombreAscii(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]|["\\]/g, '_');
}

export function construirContentDisposition(nombreArchivo: string, mimeType: string): string {
  const tipo = TIPOS_PERMITIDOS.get(mimeType)?.enLinea ? 'inline' : 'attachment';
  return `${tipo}; filename="${nombreAscii(nombreArchivo)}"; filename*=UTF-8''${codificarRfc5987(nombreArchivo)}`;
}

/**
 * Multer (vía Nest) produce mensajes en inglés para el exceso de tamaño o de archivos;
 * se traducen sin tocar el resto de errores.
 */
export function traducirErrorCarga(error: unknown): unknown {
  if (error instanceof PayloadTooLargeException) {
    return new PayloadTooLargeException(
      `Cada archivo puede pesar máximo ${TAMANO_MAXIMO_MB} MB`,
    );
  }
  if (
    error instanceof BadRequestException &&
    /^(Unexpected file field|Unexpected field|Too many files)/.test(error.message)
  ) {
    return new BadRequestException(
      `Se permiten máximo ${MAX_ADJUNTOS_POR_ENTRADA} archivos y solo en el campo "${CAMPO_ARCHIVOS}"`,
    );
  }
  return error;
}
