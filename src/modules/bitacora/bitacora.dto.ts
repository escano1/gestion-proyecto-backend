import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import {
  recortar,
  recortarONulo,
} from '../../common/validacion/transformaciones.js';

/** Campos de texto del `multipart/form-data`; los archivos llegan en `archivos`. */
export class CrearEntradaDto {
  @EsFecha()
  fecha: string;

  @Transform(recortar)
  @IsString()
  @Length(1, 5000)
  descripcion: string;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class FiltroBitacoraDto {
  @IsOptional()
  @EsFecha()
  desde?: string;

  @IsOptional()
  @EsFecha()
  hasta?: string;
}
