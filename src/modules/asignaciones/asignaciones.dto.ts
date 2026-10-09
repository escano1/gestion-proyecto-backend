import { PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import { recortarONulo } from '../../common/validacion/transformaciones.js';

export class CrearAsignacionDto {
  @IsInt()
  @Min(1)
  trabajadorId: number;

  @IsInt()
  @Min(1)
  proyectoId: number;

  @EsFecha()
  fechaInicio: string;

  /** null u omitida = asignación abierta. */
  @IsOptional()
  @EsFecha()
  fechaFin?: string | null;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(100)
  rolEnProyecto?: string | null;
}

/** `skipNullProperties: false`: `fechaInicio` no acepta null; `fechaFin: null` deja la asignación abierta. */
export class ActualizarAsignacionDto extends PartialType(
  PickType(CrearAsignacionDto, [
    'fechaInicio',
    'fechaFin',
    'rolEnProyecto',
  ] as const),
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

  /** Asignaciones vigentes en esa fecha. */
  @IsOptional()
  @EsFecha()
  vigenteEn?: string;

  /** Con `hasta`: asignaciones que se solapan con el rango. */
  @IsOptional()
  @EsFecha()
  desde?: string;

  @IsOptional()
  @EsFecha()
  hasta?: string;
}
