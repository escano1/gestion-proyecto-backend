import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { BitacoraAdjunto, BitacoraEntrada } from './bitacora.entity.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import type { Fecha } from '../../common/utils/fechas.js';

export interface AdjuntoRespuesta {
  id: number;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  creadoEn: Date;
}

export interface EntradaRespuesta {
  id: number;
  proyectoId: number;
  fecha: Fecha;
  descripcion: string;
  observaciones: string | null;
  autor: { id: number; nombre: string };
  adjuntos: AdjuntoRespuesta[];
  creadoEn: Date;
}

/** Además del rol de escritura, solo el autor o un ADMIN pueden borrar una entrada o sus adjuntos. */
export function verificarAutorOAdmin(usuario: UsuarioAutenticado, autorId: number): void {
  if (usuario.rol !== Rol.ADMIN && usuario.id !== autorId) {
    throw new ForbiddenException(
      'Solo el autor de la entrada o un administrador puede eliminarla o eliminar sus adjuntos',
    );
  }
}

export function validarRangoFechas(desde?: Fecha, hasta?: Fecha): void {
  if (desde && hasta && desde > hasta) {
    throw new BadRequestException('La fecha "desde" no puede ser posterior a "hasta"');
  }
}

/** Metadatos del adjunto; el contenido binario nunca se expone en listados. */
export function aAdjuntoRespuesta(
  adjunto: Pick<BitacoraAdjunto, 'id' | 'nombreArchivo' | 'mimeType' | 'tamanoBytes' | 'creadoEn'>,
): AdjuntoRespuesta {
  return {
    id: adjunto.id,
    nombreArchivo: adjunto.nombreArchivo,
    mimeType: adjunto.mimeType,
    tamanoBytes: adjunto.tamanoBytes,
    creadoEn: adjunto.creadoEn,
  };
}

/** Requiere las relaciones `autor` y `adjuntos` cargadas. */
export function aEntradaRespuesta(entrada: BitacoraEntrada): EntradaRespuesta {
  return {
    id: entrada.id,
    proyectoId: entrada.proyectoId,
    fecha: entrada.fecha,
    descripcion: entrada.descripcion,
    observaciones: entrada.observaciones,
    autor: { id: entrada.autor.id, nombre: entrada.autor.nombre },
    adjuntos: [...entrada.adjuntos].sort((a, b) => a.id - b.id).map(aAdjuntoRespuesta),
    creadoEn: entrada.creadoEn,
  };
}
