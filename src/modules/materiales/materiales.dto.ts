import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsPositive, IsString, MaxLength, Min } from 'class-validator';
import { recortar } from '../../common/validacion/transformaciones.js';

export class CrearMaterialDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unidadMedida: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cantidadSolicitada: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario: number;
}

/** `skipNullProperties: false`: los campos obligatorios no aceptan `null` en la edición. */
export class ActualizarMaterialDto extends PartialType(CrearMaterialDto, {
  skipNullProperties: false,
}) {}
