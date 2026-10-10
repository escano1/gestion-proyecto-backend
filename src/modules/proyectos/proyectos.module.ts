import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from './proyecto.entity.js';
import { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import { RegistroHoras } from '../registro-horas/registro-horas.entity.js';
import { MaterialProyecto } from '../materiales/material-proyecto.entity.js';
import { ProyectosService } from './proyectos.service.js';
import { ProyectosController } from './proyectos.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Proyecto,
      AsignacionProyecto,
      RegistroHoras,
      MaterialProyecto,
    ]),
  ],
  controllers: [ProyectosController],
  providers: [ProyectosService],
})
export class ProyectosModule {}
