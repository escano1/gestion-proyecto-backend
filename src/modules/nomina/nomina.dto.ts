import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TipoPeriodo } from './nomina.entity.js';
import { ANIO_MAXIMO_NOMINA, ANIO_MINIMO_NOMINA } from './calculo/periodo.js';

export class CrearLiquidacionDto {
  @IsEnum(TipoPeriodo)
  tipoPeriodo: TipoPeriodo;

  @IsInt()
  @Min(ANIO_MINIMO_NOMINA)
  @Max(ANIO_MAXIMO_NOMINA)
  anio: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  /** Obligatoria si QUINCENAL y prohibida si MENSUAL (se valida al construir el periodo). */
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  quincena?: number | null;
}

export class FiltroLiquidacionesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(ANIO_MINIMO_NOMINA)
  @Max(ANIO_MAXIMO_NOMINA)
  anio?: number;
}
