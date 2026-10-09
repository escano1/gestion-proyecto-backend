import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import { EstadoMaterial } from './material-proyecto.entity.js';
import {
  definido,
  recortar,
  recortarONulo,
} from '../../common/validacion/transformaciones.js';

/** Opcional pero no anulable: a diferencia de @IsOptional, un `null` explícito se valida. */

export class CrearMaterialDto {
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

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unidadMedida: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cantidadSolicitada: number;

  @ValidateIf(definido)
  @IsEnum(EstadoMaterial)
  estado?: EstadoMaterial;

  @ValidateIf(definido)
  @EsFecha()
  fechaSolicitud?: string;

  @IsOptional()
  @EsFecha()
  fechaRequerida?: string | null;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

/** `skipNullProperties: false`: los campos obligatorios no aceptan `null` en la edición. */
export class ActualizarMaterialDto extends PartialType(CrearMaterialDto, {
  skipNullProperties: false,
}) {
  @ValidateIf(definido)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cantidadEntregada?: number;

  @IsOptional()
  @EsFecha()
  fechaEntrega?: string | null;
}

export class FiltroMaterialesDto {
  @IsOptional()
  @IsEnum(EstadoMaterial)
  estado?: EstadoMaterial;
}
