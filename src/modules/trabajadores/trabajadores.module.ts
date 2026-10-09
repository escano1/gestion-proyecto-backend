import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trabajador } from './trabajador.entity.js';
import { LiquidacionNomina } from '../nomina/nomina.entity.js';
import { TrabajadoresService } from './trabajadores.service.js';
import { TrabajadoresController } from './trabajadores.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Trabajador, LiquidacionNomina])],
  controllers: [TrabajadoresController],
  providers: [TrabajadoresService],
})
export class TrabajadoresModule {}
