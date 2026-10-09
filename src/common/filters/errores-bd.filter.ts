import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

interface ErrorPostgres {
  code?: string;
}

/** Traduce violaciones de restricciones de PostgreSQL a respuestas HTTP comprensibles. */
@Catch(QueryFailedError)
export class ErroresBaseDatosFilter extends BaseExceptionFilter {
  override catch(error: QueryFailedError, host: ArgumentsHost): void {
    const { code } = error.driverError as ErrorPostgres;
    switch (code) {
      case '23505':
        return super.catch(
          new ConflictException('Ya existe un registro con esos datos'),
          host,
        );
      case '23503':
        return super.catch(
          new ConflictException(
            'La operación no es posible porque el registro está relacionado con otros datos',
          ),
          host,
        );
      case '23514':
      case '22P02':
      case '22003':
        return super.catch(
          new BadRequestException('Datos inválidos para la base de datos'),
          host,
        );
      default:
        return super.catch(error, host);
    }
  }
}
