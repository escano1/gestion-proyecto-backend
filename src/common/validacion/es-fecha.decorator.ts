import { registerDecorator, type ValidationOptions } from 'class-validator';
import { esFechaValida } from '../utils/fechas.js';

/** Valida una fecha de calendario `YYYY-MM-DD` existente. */
export function EsFecha(opciones?: ValidationOptions): PropertyDecorator {
  return (objeto: object, propiedad: string | symbol) =>
    registerDecorator({
      name: 'esFecha',
      target: objeto.constructor,
      propertyName: propiedad.toString(),
      options: {
        message: `${propiedad.toString()} debe ser una fecha válida con formato YYYY-MM-DD`,
        ...opciones,
      },
      validator: { validate: (valor: unknown) => esFechaValida(valor) },
    });
}
