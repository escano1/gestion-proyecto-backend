import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsignacionProyecto } from './asignacion-proyecto.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { RegistroHoras } from '../registro-horas/registro-horas.entity.js';
import { AsignacionesService } from './asignaciones.service.js';
import { AsignacionesController } from './asignaciones.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AsignacionProyecto, Trabajador, Proyecto, RegistroHoras]),
  ],
  controllers: [AsignacionesController],
  providers: [AsignacionesService],
})
export class AsignacionesModule {}
