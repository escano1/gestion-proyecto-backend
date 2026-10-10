import { compare, hash } from 'bcryptjs';
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const COSTO_BCRYPT = 10;
// bcrypt ignora todo lo que supere 72 bytes.
const BYTES_MAXIMOS = 72;

export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Política mínima (uso interno de una sola persona): solo se exige que no esté vacía y que bcrypt
 * no la trunque. No se pide longitud, letras ni números.
 */
export function erroresPoliticaPassword(password: string): string[] {
  const errores: string[] = [];
  if (password.length === 0) errores.push('La contraseña no puede estar vacía');
  if (Buffer.byteLength(password, 'utf8') > BYTES_MAXIMOS) {
    errores.push(`La contraseña no puede superar ${BYTES_MAXIMOS} caracteres`);
  }
  return errores;
}

/** Valida en el DTO que la contraseña cumpla la política. */
export function CumplePoliticaPassword(opciones?: ValidationOptions): PropertyDecorator {
  return (objeto: object, propiedad: string | symbol) =>
    registerDecorator({
      name: 'politicaPassword',
      target: objeto.constructor,
      propertyName: propiedad.toString(),
      options: {
        message: ({ value }: ValidationArguments) =>
          typeof value === 'string'
            ? erroresPoliticaPassword(value).join('; ')
            : `${propiedad.toString()} debe ser texto`,
        ...opciones,
      },
      validator: {
        validate: (valor: unknown) =>
          typeof valor === 'string' && erroresPoliticaPassword(valor).length === 0,
      },
    });
}

export const hashearPassword = (password: string): Promise<string> =>
  hash(password, COSTO_BCRYPT);

export const verificarPassword = (password: string, passwordHash: string): Promise<boolean> =>
  compare(password, passwordHash);
