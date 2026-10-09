import type { ValueTransformer } from 'typeorm';

/** PostgreSQL devuelve `numeric` como string; lo exponemos como number. */
export const transformadorNumerico: ValueTransformer = {
  to: (valor: number | null | undefined) => valor,
  from: (valor: string | null | undefined) =>
    valor === null || valor === undefined ? valor : Number(valor),
};
