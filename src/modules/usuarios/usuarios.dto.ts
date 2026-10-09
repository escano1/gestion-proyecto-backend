import { PartialType, PickType } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Rol } from '../../common/enums/rol.enum.js';
import { CumplePoliticaPassword, normalizarEmail } from './credenciales.js';
import { recortar } from '../../common/validacion/transformaciones.js';

const aEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? normalizarEmail(value) : value;

export class CrearUsuarioDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @Transform(aEmail)
  @IsEmail({}, { message: 'email debe ser un correo electrónico válido' })
  @MaxLength(160)
  email: string;

  @CumplePoliticaPassword()
  password: string;

  @IsEnum(Rol)
  rol: Rol;
}

/** `skipNullProperties: false`: un `null` explícito se valida (y se rechaza) en vez de ignorarse. */
export class ActualizarUsuarioDto extends PartialType(
  PickType(CrearUsuarioDto, ['nombre', 'rol', 'password'] as const),
  { skipNullProperties: false },
) {
  @ValidateIf((_dto: object, valor: unknown) => valor !== undefined)
  @IsBoolean()
  activo?: boolean;
}
