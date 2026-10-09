import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import { CodigoParametro } from './parametro-legal.entity.js';

export class CrearParametroDto {
  @IsEnum(CodigoParametro)
  codigo: CodigoParametro;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  valor: number;

  @EsFecha()
  vigenteDesde: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  norma?: string;
}

export class FechaOpcionalDto {
  @IsOptional()
  @EsFecha()
  fecha?: string;
}
