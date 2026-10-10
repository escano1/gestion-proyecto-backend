import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';

export const AGRUPACIONES_HORAS = [
  'trabajador',
  'proyecto',
  'tipo',
  'fecha',
] as const;
export type AgrupacionHoras = (typeof AGRUPACIONES_HORAS)[number];

export class RangoFechasDto {
  @EsFecha()
  desde: string;

  @EsFecha()
  hasta: string;
}

export class RangoOpcionalDto {
  @IsOptional()
  @EsFecha()
  desde?: string;

  @IsOptional()
  @EsFecha()
  hasta?: string;
}

export class ReporteHorasDto extends RangoFechasDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  trabajadorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  proyectoId?: number;

  @IsOptional()
  @IsIn([...AGRUPACIONES_HORAS], {
    message: `agrupacion debe ser uno de: ${AGRUPACIONES_HORAS.join(', ')}`,
  })
  agrupacion: AgrupacionHoras = 'trabajador';
}

export class NominaPeriodosDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio: number;
}
