import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
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
import {
  EstadoTrabajador,
  TipoContrato,
  TipoDocumento,
  TipoJornada,
  TipoSalario,
} from './trabajador.entity.js';
import {
  definido,
  recortar,
  recortarONulo,
} from '../../common/validacion/transformaciones.js';

/** Opcional pero no anulable: a diferencia de @IsOptional, un `null` explícito se valida. */

export class CrearTrabajadorDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsEnum(TipoDocumento)
  tipoDocumento: TipoDocumento;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  numeroDocumento: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cargo: string;

  @IsEnum(TipoSalario)
  tipoSalario: TipoSalario;

  /** Salario mensual (MENSUAL) o valor de la hora (POR_HORA). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(999_999_999_999)
  salarioBase: number;

  @IsEnum(TipoContrato)
  tipoContrato: TipoContrato;

  @ValidateIf(definido)
  @IsEnum(TipoJornada)
  tipoJornada?: TipoJornada;

  /** Obligatorio si la jornada es PARCIAL; se limpia si es COMPLETA. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(48)
  horasSemanales?: number | null;

  @ValidateIf(definido)
  @IsEnum(EstadoTrabajador)
  estado?: EstadoTrabajador;

  @IsOptional()
  @Transform(recortarONulo)
  @IsEmail({}, { message: 'email debe ser un correo electrónico válido' })
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(30)
  telefono?: string | null;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(100)
  eps?: string | null;

  @IsOptional()
  @Transform(recortarONulo)
  @IsString()
  @MaxLength(100)
  fondoPension?: string | null;
}

/** `skipNullProperties: false`: los campos obligatorios no aceptan `null` en la edición. */
export class ActualizarTrabajadorDto extends PartialType(CrearTrabajadorDto, {
  skipNullProperties: false,
}) {}

export class FiltroTrabajadoresDto {
  @IsOptional()
  @IsEnum(EstadoTrabajador)
  estado?: EstadoTrabajador;

  /** Busca en nombre o número de documento. */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(100)
  q?: string;
}
