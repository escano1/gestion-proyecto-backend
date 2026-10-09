import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import { LiquidacionNomina } from '../nomina/nomina.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { RegistroHorasController } from './registro-horas.controller.js';
import {
  RegistroHoras,
  RegistroHorasDetalle,
} from './registro-horas.entity.js';
import { RegistroHorasService } from './registro-horas.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegistroHoras,
      RegistroHorasDetalle,
      TipoHora,
      Trabajador,
      Proyecto,
      AsignacionProyecto,
      LiquidacionNomina,
    ]),
  ],
  controllers: [RegistroHorasController],
  providers: [RegistroHorasService],
})
export class RegistroHorasModule {}
