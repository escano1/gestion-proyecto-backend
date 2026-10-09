import type { TransformFnParams } from 'class-transformer';

/** `@Transform(recortar)`: quita espacios de los extremos. */
export const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** `@Transform(recortarONulo)`: quita espacios y convierte la cadena vacía en null (limpia el campo). */
export const recortarONulo = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

/** Para `@ValidateIf(definido)`: valida el campo cuando viene en el cuerpo, incluso si es null. */
export const definido = (_dto: object, valor: unknown): boolean =>
  valor !== undefined;
