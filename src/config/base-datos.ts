import pg from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { ENTIDADES } from '../database/entidades.js';
import { MIGRACIONES } from '../database/migraciones.js';
import { EstrategiaNombresSnake } from '../database/estrategia-nombres.js';

// DATE (oid 1082) se maneja como texto YYYY-MM-DD para evitar corrimientos por zona horaria.
pg.types.setTypeParser(1082, (valor: string) => valor);

export function crearOpcionesBaseDatos(
  entorno: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  const url = entorno.DATABASE_URL;
  if (!url) throw new Error('La variable DATABASE_URL es obligatoria');

  return {
    type: 'postgres',
    url,
    ssl: entorno.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: ENTIDADES,
    migrations: MIGRACIONES,
    namingStrategy: new EstrategiaNombresSnake(),
    synchronize: false,
    migrationsTransactionMode: 'each',
    logging: entorno.DB_LOGGING === 'true' ? ['query', 'error'] : ['error'],
  };
}
