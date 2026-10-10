import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import { EstadoProyecto } from './proyecto.entity.js';
import {
  definido,
  recortar,
  recortarONulo,
} from '../../common/validacion/transformaciones.js';

/** Opcional pero no anulable: a diferencia de @IsOptional, un `null` explícito se valida. */

export class CrearProyectoDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  codigo: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(150)
  cliente?: string | null;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(200)
  ubicacion?: string | null;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @EsFecha()
  fechaInicio: string;

  @IsOptional()
  @EsFecha()
  fechaFinPlaneada?: string | null;

  @IsOptional()
  @EsFecha()
  fechaFinReal?: string | null;

  @ValidateIf(definido)
  @IsEnum(EstadoProyecto)
  estado?: EstadoProyecto;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999_999_999)
  presupuesto?: number | null;
}

/** `skipNullProperties: false`: los campos obligatorios no aceptan `null` en la edición. */
export class ActualizarProyectoDto extends PartialType(CrearProyectoDto, {
  skipNullProperties: false,
}) {}

export class FiltroProyectosDto {
  @IsOptional()
  @IsEnum(EstadoProyecto)
  estado?: EstadoProyecto;
}
