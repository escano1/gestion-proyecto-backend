import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import { EstadoHerramienta } from './herramienta-proyecto.entity.js';
import {
  definido,
  recortar,
  recortarONulo,
} from '../../common/validacion/transformaciones.js';

/** Opcional pero no anulable: a diferencia de @IsOptional, un `null` explícito se valida. */

export class CrearHerramientaDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  /** Serial o placa de inventario. */
  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(50)
  codigo?: string | null;

  @IsInt()
  @Min(1)
  cantidad: number;

  /** Trabajador responsable; `null` la deja sin responsable. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  responsableId?: number | null;

  @EsFecha()
  fechaAsignacion: string;

  @IsOptional()
  @EsFecha()
  fechaDevolucionPrevista?: string | null;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

/** `skipNullProperties: false`: los campos obligatorios no aceptan `null` en la edición. */
export class ActualizarHerramientaDto extends PartialType(CrearHerramientaDto, {
  skipNullProperties: false,
}) {
  @ValidateIf(definido)
  @IsEnum(EstadoHerramienta)
  estado?: EstadoHerramienta;

  @IsOptional()
  @EsFecha()
  fechaDevolucion?: string | null;
}

export class FiltroHerramientasDto {
  @IsOptional()
  @IsEnum(EstadoHerramienta)
  estado?: EstadoHerramienta;
}
