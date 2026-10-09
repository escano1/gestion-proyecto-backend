import { compare, hash } from 'bcryptjs';
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const COSTO_BCRYPT = 10;
const LONGITUD_MINIMA = 8;
// bcrypt ignora todo lo que supere 72 bytes.
const BYTES_MAXIMOS = 72;

export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

/** Política: mínimo 8 caracteres, al menos una letra y un número. */
export function erroresPoliticaPassword(password: string): string[] {
  const errores: string[] = [];
  if (password.length < LONGITUD_MINIMA) {
    errores.push(`La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres`);
  }
  if (Buffer.byteLength(password, 'utf8') > BYTES_MAXIMOS) {
    errores.push(`La contraseña no puede superar ${BYTES_MAXIMOS} caracteres`);
  }
  if (!/\p{L}/u.test(password)) {
    errores.push('La contraseña debe contener al menos una letra');
  }
  if (!/\p{Nd}/u.test(password)) {
    errores.push('La contraseña debe contener al menos un número');
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
