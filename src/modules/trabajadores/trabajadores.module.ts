import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trabajador } from './trabajador.entity.js';
import { LiquidacionNomina, NominaTrabajador } from '../nomina/nomina.entity.js';
import { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import { RegistroHoras } from '../registro-horas/registro-horas.entity.js';
import { TrabajadoresService } from './trabajadores.service.js';
import { TrabajadoresController } from './trabajadores.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trabajador, LiquidacionNomina, NominaTrabajador, AsignacionProyecto, RegistroHoras]),
  ],
  controllers: [TrabajadoresController],
  providers: [TrabajadoresService],
})
export class TrabajadoresModule {}
