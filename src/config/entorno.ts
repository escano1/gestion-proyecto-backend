import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class VariablesEntorno {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET debe tener al menos 32 caracteres' })
  JWT_SECRET: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres' })
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;
}

export function validarEntorno(config: Record<string, unknown>): Record<string, unknown> {
  const variables = plainToInstance(VariablesEntorno, config, {
    enableImplicitConversion: true,
  });
  const errores = validateSync(variables, { skipMissingProperties: false });
  if (errores.length) {
    const detalle = errores
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('; ');
    throw new Error(`Configuración de entorno inválida: ${detalle}`);
  }
  return config;
}
