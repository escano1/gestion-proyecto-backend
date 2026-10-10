import { PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { recortarONulo } from '../../common/validacion/transformaciones.js';

export class CrearAsignacionDto {
  @IsInt()
  @Min(1)
  trabajadorId: number;

  @IsInt()
  @Min(1)
  proyectoId: number;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(100)
  rolEnProyecto?: string | null;
}

export class ActualizarAsignacionDto extends PartialType(
  PickType(CrearAsignacionDto, ['rolEnProyecto'] as const),
  { skipNullProperties: false },
) {}

export class FiltroAsignacionesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  proyectoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  trabajadorId?: number;
}
