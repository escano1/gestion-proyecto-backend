import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validarEntorno } from './config/entorno.js';
import { crearOpcionesBaseDatos } from './config/base-datos.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { HealthController } from './modules/health/health.controller.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { ParametrosModule } from './modules/parametros/parametros.module.js';
import { TiposHoraModule } from './modules/tipos-hora/tipos-hora.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { TrabajadoresModule } from './modules/trabajadores/trabajadores.module.js';
import { ProyectosModule } from './modules/proyectos/proyectos.module.js';
import { AsignacionesModule } from './modules/asignaciones/asignaciones.module.js';
import { RegistroHorasModule } from './modules/registro-horas/registro-horas.module.js';
import { NominaModule } from './modules/nomina/nomina.module.js';
import { MaterialesModule } from './modules/materiales/materiales.module.js';
import { ReportesModule } from './modules/reportes/reportes.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...crearOpcionesBaseDatos(),
        // Aplica migraciones pendientes antes del bootstrap (crea el admin inicial): el
        // despliegue no depende de que el pre-deploy de Railway se haya ejecutado.
        migrationsRun: process.env.DB_MIGRAR_AL_ARRANCAR !== 'false',
      }),
    }),
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuditoriaModule,
    ParametrosModule,
    TiposHoraModule,
    AuthModule,
    UsuariosModule,
    TrabajadoresModule,
    ProyectosModule,
    AsignacionesModule,
    RegistroHorasModule,
    NominaModule,
    MaterialesModule,
    ReportesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
