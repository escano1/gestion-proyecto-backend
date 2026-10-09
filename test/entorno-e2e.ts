import { existsSync } from 'node:fs';

// Se ejecuta antes de importar AppModule: la app de pruebas apunta a la BD de pruebas.
if (existsSync('.env')) process.loadEnvFile('.env');

const urlPruebas = process.env.TEST_DATABASE_URL;
if (!urlPruebas) {
  throw new Error('Defina TEST_DATABASE_URL para ejecutar las pruebas e2e');
}
if (urlPruebas === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL no puede ser la misma base de DATABASE_URL');
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: urlPruebas,
  DB_LOGGING: 'false',
  SWAGGER_ENABLED: 'false',
  ADMIN_EMAIL: 'admin@pruebas.co',
  ADMIN_PASSWORD: 'Admin12345',
  ADMIN_NOMBRE: 'Admin Pruebas',
  CORS_ORIGINS: 'http://localhost:3000,https://*.vercel.app',
});
process.env.JWT_SECRET ??= 'secreto-de-pruebas-e2e-con-mas-de-32-caracteres';
process.env.JWT_REFRESH_SECRET ??= 'secreto-refresh-de-pruebas-e2e-con-mas-de-32-caracteres';
