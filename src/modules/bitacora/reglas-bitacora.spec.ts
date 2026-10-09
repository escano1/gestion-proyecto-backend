import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { BitacoraAdjunto, BitacoraEntrada } from './bitacora.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import {
  aEntradaRespuesta,
  validarRangoFechas,
  verificarAutorOAdmin,
} from './reglas-bitacora.js';

const usuario = (id: number, rol: Rol): UsuarioAutenticado => ({
  id,
  rol,
  email: `u${id}@empresa.co`,
  nombre: `Usuario ${id}`,
});

describe('verificarAutorOAdmin', () => {
  it('permite al autor', () => {
    expect(() => verificarAutorOAdmin(usuario(7, Rol.GESTOR_PROYECTOS), 7)).not.toThrow();
  });

  it('permite a un ADMIN aunque no sea el autor', () => {
    expect(() => verificarAutorOAdmin(usuario(1, Rol.ADMIN), 7)).not.toThrow();
  });

  it('rechaza a otro gestor con 403', () => {
    expect(() => verificarAutorOAdmin(usuario(8, Rol.GESTOR_PROYECTOS), 7)).toThrow(
      ForbiddenException,
    );
  });
});

describe('validarRangoFechas', () => {
  it('acepta rangos válidos o abiertos', () => {
    expect(() => validarRangoFechas('2026-01-01', '2026-01-31')).not.toThrow();
    expect(() => validarRangoFechas('2026-01-01', undefined)).not.toThrow();
    expect(() => validarRangoFechas(undefined, undefined)).not.toThrow();
  });

  it('rechaza desde posterior a hasta', () => {
    expect(() => validarRangoFechas('2026-02-01', '2026-01-31')).toThrow(BadRequestException);
  });
});

describe('aEntradaRespuesta', () => {
  it('expone autor y metadatos de adjuntos ordenados, sin contenido', () => {
    const creadoEn = new Date('2026-10-08T15:00:00Z');
    const autor = Object.assign(new Usuario(), { id: 7, nombre: 'Ana', email: 'ana@empresa.co' });
    const adjunto = (id: number) =>
      Object.assign(new BitacoraAdjunto(), {
        id,
        entradaId: 3,
        nombreArchivo: `f${id}.pdf`,
        mimeType: 'application/pdf',
        tamanoBytes: 10,
        contenido: Buffer.from('%PDF-'),
        creadoEn,
      });
    const entrada = Object.assign(new BitacoraEntrada(), {
      id: 3,
      proyectoId: 2,
      fecha: '2026-10-08',
      descripcion: 'Tendido de cable',
      observaciones: null,
      autorId: 7,
      autor,
      adjuntos: [adjunto(9), adjunto(4)],
      creadoEn,
    });

    expect(aEntradaRespuesta(entrada)).toEqual({
      id: 3,
      proyectoId: 2,
      fecha: '2026-10-08',
      descripcion: 'Tendido de cable',
      observaciones: null,
      autor: { id: 7, nombre: 'Ana' },
      adjuntos: [
        { id: 4, nombreArchivo: 'f4.pdf', mimeType: 'application/pdf', tamanoBytes: 10, creadoEn },
        { id: 9, nombreArchivo: 'f9.pdf', mimeType: 'application/pdf', tamanoBytes: 10, creadoEn },
      ],
      creadoEn,
    });
  });
});
