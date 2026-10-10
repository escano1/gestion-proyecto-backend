import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import { ANIO_MAXIMO_NOMINA, ANIO_MINIMO_NOMINA } from './calculo/periodo.js';

export class CrearLiquidacionDto {
  /** Cualquier día de la semana que se liquida (lunes a domingo). */
  @EsFecha()
  fecha: string;
}

export class FiltroLiquidacionesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(ANIO_MINIMO_NOMINA)
  @Max(ANIO_MAXIMO_NOMINA)
  anio?: number;
}
