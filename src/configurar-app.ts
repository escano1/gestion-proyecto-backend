import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ErroresBaseDatosFilter } from './common/filters/errores-bd.filter.js';

/** Convierte CORS_ORIGINS ("https://a.com,https://*.vercel.app") en reglas para cors. */
export function origenesPermitidos(valor: string | undefined): (string | RegExp)[] {
  return (valor ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .map((o) =>
      o.includes('*')
        ? new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`)
        : o,
    );
}

/** Configuración compartida por main.ts y las pruebas e2e. */
export function configurarApp(app: INestApplication): void {
  const express = app as NestExpressApplication;
  // Railway termina TLS en su proxy: necesario para IP real (rate limit) y protocolo.
  express.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: origenesPermitidos(process.env.CORS_ORIGINS),
    credentials: false,
    exposedHeaders: ['Content-Disposition'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new ErroresBaseDatosFilter(httpAdapter));
  app.enableShutdownHooks();

  const swaggerHabilitado =
    process.env.SWAGGER_ENABLED === 'true' ||
    (process.env.SWAGGER_ENABLED === undefined && process.env.NODE_ENV !== 'production');
  if (swaggerHabilitado) {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Gestión de Proyectos y Nómina')
        .setDescription('API de proyectos, registro de horas y nómina colombiana')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, documento);
  }
}
