import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParametroLegal } from './parametro-legal.entity.js';
import { LiquidacionNomina } from '../nomina/nomina.entity.js';
import { ParametrosService } from './parametros.service.js';
import { ParametrosController } from './parametros.controller.js';

/** Global: nómina, registro de horas y reportes resuelven parámetros vigentes. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ParametroLegal, LiquidacionNomina])],
  controllers: [ParametrosController],
  providers: [ParametrosService],
  exports: [ParametrosService],
})
export class ParametrosModule {}
