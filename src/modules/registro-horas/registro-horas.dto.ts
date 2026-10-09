import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginacionDto } from '../../common/dto/paginacion.dto.js';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';

/** Hay 8 tipos de hora; el margen permite que la validación de negocio reporte repetidos. */
const MAXIMO_DETALLES = 20;

export class DetalleHorasDto {
  @IsInt()
  @Min(1)
  tipoHoraId: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'horas debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'horas no puede ser negativo' })
  @Max(24, { message: 'horas no puede superar 24' })
  horas: number;
}

export class CrearRegistroHorasDto {
  @IsInt()
  @Min(1)
  trabajadorId: number;

  @IsInt()
  @Min(1)
  proyectoId: number;

  @EsFecha()
  fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string | null;

  @IsArray()
  @ArrayMinSize(1, {
    message: 'Debe registrar horas en al menos un tipo de hora',
  })
  @ArrayMaxSize(MAXIMO_DETALLES)
  @ValidateNested({ each: true })
  @Type(() => DetalleHorasDto)
  detalles: DetalleHorasDto[];
}

export class ActualizarRegistroHorasDto {
  /** `null` o vacío borra la observación. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string | null;

  /** Reemplaza el conjunto completo de detalles. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Debe registrar horas en al menos un tipo de hora',
  })
  @ArrayMaxSize(MAXIMO_DETALLES)
  @ValidateNested({ each: true })
  @Type(() => DetalleHorasDto)
  detalles?: DetalleHorasDto[];
}

/** Ítem del lote: sin detalles o con todas las horas en 0 elimina el registro existente. */
export class RegistroLoteDto {
  @IsInt()
  @Min(1)
  trabajadorId: number;

  @IsInt()
  @Min(1)
  proyectoId: number;

  @EsFecha()
  fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string | null;

  @IsArray()
  @ArrayMaxSize(MAXIMO_DETALLES)
  @ValidateNested({ each: true })
  @Type(() => DetalleHorasDto)
  detalles: DetalleHorasDto[];
}

export class LoteRegistroHorasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RegistroLoteDto)
  registros: RegistroLoteDto[];
}

export class FiltroRegistroHorasDto extends PaginacionDto {
  @IsOptional()
  @EsFecha()
  desde?: string;

  @IsOptional()
  @EsFecha()
  hasta?: string;

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
}
