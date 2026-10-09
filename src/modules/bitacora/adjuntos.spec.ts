import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  type ArchivoCargado,
  construirContentDisposition,
  esTipoPermitido,
  normalizarNombreArchivo,
  prepararAdjuntos,
  traducirErrorCarga,
  validarArchivo,
  validarCantidadAdjuntos,
} from './adjuntos.js';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const bytes = (...valores: (number | string)[]) =>
  Buffer.concat(
    valores.map((v) => (typeof v === 'string' ? Buffer.from(v, 'latin1') : Buffer.from([v]))),
  );

const MUESTRAS: Record<string, Buffer> = {
  'image/jpeg': bytes(0xff, 0xd8, 0xff, 0xe0, 0x00),
  'image/png': bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0x00),
  'image/webp': bytes('RIFF', 0x24, 0x00, 0x00, 0x00, 'WEBPVP8 '),
  'application/pdf': bytes('%PDF-1.7\n'),
  [DOCX]: bytes('PK', 0x03, 0x04, 0x14),
  [XLSX]: bytes('PK', 0x03, 0x04, 0x14),
};

const archivo = (mimetype: string, buffer: Buffer, originalname = 'prueba'): ArchivoCargado => ({
  originalname,
  mimetype,
  buffer,
});

describe('esTipoPermitido', () => {
  it.each(Object.keys(MUESTRAS))('permite %s', (mime) => {
    expect(esTipoPermitido(mime)).toBe(true);
  });

  it.each(['text/html', 'image/svg+xml', 'application/zip', 'application/msword', 'constructor'])(
    'rechaza %s',
    (mime) => {
      expect(esTipoPermitido(mime)).toBe(false);
    },
  );
});

describe('validarArchivo', () => {
  it.each(Object.entries(MUESTRAS))('acepta %s con firma correcta', (mime, contenido) => {
    expect(() => validarArchivo(archivo(mime, contenido))).not.toThrow();
  });

  it('acepta PDF con bytes previos a la cabecera', () => {
    expect(() =>
      validarArchivo(archivo('application/pdf', bytes(0x0a, 0x0a, '%PDF-1.4'))),
    ).not.toThrow();
  });

  it('rechaza tipos no permitidos', () => {
    expect(() => validarArchivo(archivo('text/html', bytes('<html>'), 'x.html'))).toThrow(
      BadRequestException,
    );
    expect(() => validarArchivo(archivo('text/html', bytes('<html>'), 'x.html'))).toThrow(
      /no es de un tipo permitido/,
    );
  });

  it('rechaza archivos vacíos', () => {
    expect(() => validarArchivo(archivo('image/png', Buffer.alloc(0)))).toThrow(/está vacío/);
  });

  it('rechaza contenido que no corresponde al tipo declarado', () => {
    expect(() => validarArchivo(archivo('image/png', bytes('<script>')))).toThrow(
      /no corresponde a un archivo PNG/,
    );
    expect(() => validarArchivo(archivo('application/pdf', MUESTRAS['image/jpeg']))).toThrow(
      /no corresponde a un archivo PDF/,
    );
    expect(() => validarArchivo(archivo('image/webp', bytes('RIFF', 0, 0, 0, 0, 'WAVE')))).toThrow(
      BadRequestException,
    );
  });
});

describe('validarCantidadAdjuntos', () => {
  it('permite hasta 5 en total', () => {
    expect(() => validarCantidadAdjuntos(0, 5)).not.toThrow();
    expect(() => validarCantidadAdjuntos(3, 2)).not.toThrow();
  });

  it('rechaza más de 5 en total', () => {
    expect(() => validarCantidadAdjuntos(4, 2)).toThrow(BadRequestException);
    expect(() => validarCantidadAdjuntos(0, 6)).toThrow(/máximo 5 adjuntos/);
  });
});

describe('normalizarNombreArchivo', () => {
  it('conserva tildes y espacios', () => {
    expect(normalizarNombreArchivo('Acta de obra ñandú.pdf')).toBe('Acta de obra ñandú.pdf');
  });

  it('elimina separadores de ruta y caracteres de control', () => {
    expect(normalizarNombreArchivo('../a\\b\r\n.pdf')).toBe('.._a_b__.pdf');
  });

  it('usa un nombre por defecto si queda vacío', () => {
    expect(normalizarNombreArchivo('   ')).toBe('archivo');
  });

  it('recorta a 255 caracteres conservando la extensión', () => {
    const nombre = normalizarNombreArchivo(`${'a'.repeat(300)}.xlsx`);
    expect(Array.from(nombre)).toHaveLength(255);
    expect(nombre.endsWith('.xlsx')).toBe(true);
  });
});

describe('prepararAdjuntos', () => {
  it('produce metadatos y contenido', () => {
    const contenido = MUESTRAS['application/pdf'];
    expect(prepararAdjuntos([archivo('application/pdf', contenido, 'informe.pdf')])).toEqual([
      {
        nombreArchivo: 'informe.pdf',
        mimeType: 'application/pdf',
        tamanoBytes: contenido.length,
        contenido,
      },
    ]);
  });
});

describe('construirContentDisposition', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])(
    '%s se muestra en línea',
    (mime) => {
      expect(construirContentDisposition('foto.jpg', mime)).toMatch(/^inline; /);
    },
  );

  it.each([DOCX, XLSX, 'application/octet-stream'])('%s se descarga', (mime) => {
    expect(construirContentDisposition('doc.docx', mime)).toMatch(/^attachment; /);
  });

  it('codifica el nombre UTF-8 según RFC 5987 con respaldo ASCII', () => {
    expect(construirContentDisposition('Informe técnico (v2)*.pdf', 'application/pdf')).toBe(
      `inline; filename="Informe tecnico (v2)*.pdf"; filename*=UTF-8''Informe%20t%C3%A9cnico%20%28v2%29%2A.pdf`,
    );
  });

  it('escapa comillas, apóstrofes y saltos de línea', () => {
    const valor = construirContentDisposition(`a"b'c\r\n.docx`, DOCX);
    expect(valor).toBe(
      `attachment; filename="a_b'c__.docx"; filename*=UTF-8''a%22b%27c%0D%0A.docx`,
    );
  });

  it('reemplaza en el respaldo los caracteres no ASCII sin equivalente', () => {
    expect(construirContentDisposition('plano 電気.pdf', 'application/pdf')).toContain(
      'filename="plano __.pdf"',
    );
  });
});

describe('traducirErrorCarga', () => {
  it('traduce el exceso de tamaño', () => {
    const traducido = traducirErrorCarga(new PayloadTooLargeException('File too large'));
    expect(traducido).toBeInstanceOf(PayloadTooLargeException);
    expect((traducido as PayloadTooLargeException).message).toBe(
      'Cada archivo puede pesar máximo 10 MB',
    );
  });

  it('traduce el exceso de archivos o campo inesperado', () => {
    const traducido = traducirErrorCarga(
      new BadRequestException('Unexpected file field - archivos'),
    );
    expect(traducido).toBeInstanceOf(BadRequestException);
    expect((traducido as BadRequestException).message).toMatch(/máximo 5 archivos/);
  });

  it('no altera otros errores', () => {
    const propio = new BadRequestException('fecha debe ser una fecha válida');
    const generico = new Error('fallo');
    expect(traducirErrorCarga(propio)).toBe(propio);
    expect(traducirErrorCarga(generico)).toBe(generico);
  });
});
