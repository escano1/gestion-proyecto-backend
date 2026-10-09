import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import {
  definido,
  recortar,
  recortarONulo,
} from '../../common/validacion/transformaciones.js';

/** Opcional pero no anulable: a diferencia de @IsOptional, un `null` explícito se valida. */

/** El estado no se recibe: se deriva siempre de `porcentajeAvance`. */
export class CrearHitoDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @ValidateIf(definido)
  @IsInt()
  @Min(0)
  @Max(32_767)
  orden?: number;

  @EsFecha()
  fechaPlaneada: string;

  /** Peso relativo dentro del proyecto, en (0, 100]. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100)
  peso: number;

  @ValidateIf(definido)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  porcentajeAvance?: number;
}

/** `skipNullProperties: false`: los campos obligatorios no aceptan `null` en la edición. */
export class ActualizarHitoDto extends PartialType(CrearHitoDto, {
  skipNullProperties: false,
}) {
  @IsOptional()
  @EsFecha()
  fechaReal?: string | null;
}
