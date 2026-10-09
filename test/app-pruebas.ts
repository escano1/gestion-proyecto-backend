import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import { crearOpcionesBaseDatos } from '../src/config/base-datos.js';

/** Recrea el esquema de la BD de pruebas ejecutando las migraciones reales. */
export async function reiniciarBaseDatos(): Promise<void> {
  const fuente = new DataSource(crearOpcionesBaseDatos());
  await fuente.initialize();
  await fuente.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await fuente.runMigrations();
  await fuente.destroy();
}

export async function crearAppPruebas(): Promise<INestApplication<App>> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication<INestApplication<App>>();
  configurarApp(app);
  await app.init();
  return app;
}

export async function iniciarSesion(
  app: INestApplication<App>,
  email: string,
  password: string,
): Promise<string> {
  const respuesta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return respuesta.body.accessToken as string;
}
