import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { crearOpcionesBaseDatos } from '../config/base-datos.js';

// Fuente de datos para la CLI de TypeORM (migraciones). En Railway las variables ya vienen del entorno.
if (existsSync('.env')) process.loadEnvFile('.env');

export default new DataSource(crearOpcionesBaseDatos());
