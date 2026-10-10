import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  CumplePoliticaPassword,
  normalizarEmail,
} from '../usuarios/credenciales.js';

const aEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? normalizarEmail(value) : value;

export class LoginDto {
  /** Usuario de ingreso: normalmente un correo, pero se acepta cualquier texto (p. ej. "admin"). */
  @Transform(aEmail)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  refreshToken: string;
}

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  passwordActual: string;

  @CumplePoliticaPassword()
  passwordNueva: string;
}
