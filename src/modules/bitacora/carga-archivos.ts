import {
  applyDecorators,
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { catchError, type Observable, throwError } from 'rxjs';
import {
  CAMPO_ARCHIVOS,
  esTipoPermitido,
  MAX_ADJUNTOS_POR_ENTRADA,
  mensajeTipoNoPermitido,
  TAMANO_MAXIMO_BYTES,
  traducirErrorCarga,
} from './adjuntos.js';

@Injectable()
export class ErroresCargaInterceptor implements NestInterceptor {
  intercept(_contexto: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    return siguiente
      .handle()
      .pipe(catchError((error: unknown) => throwError(() => traducirErrorCarga(error))));
  }
}

const ArchivosInterceptor = FilesInterceptor(CAMPO_ARCHIVOS, MAX_ADJUNTOS_POR_ENTRADA, {
  limits: { fileSize: TAMANO_MAXIMO_BYTES },
  // Multer interpreta el nombre del archivo como latin1 por defecto y daña tildes y eñes.
  defParamCharset: 'utf8',
  // Rechaza el tipo antes de cargar el archivo en memoria; el servicio vuelve a validarlo.
  fileFilter: (_peticion, archivo, aceptar) => {
    if (esTipoPermitido(archivo.mimetype)) return aceptar(null, true);
    aceptar(new BadRequestException(mensajeTipoNoPermitido(archivo.originalname)), false);
  },
});

/** Recibe hasta 5 archivos en memoria en el campo multipart `archivos`. */
export const CargaArchivos = () =>
  applyDecorators(
    ApiConsumes('multipart/form-data'),
    // El de errores va primero para envolver al de Multer.
    UseInterceptors(ErroresCargaInterceptor, ArchivosInterceptor),
  );
