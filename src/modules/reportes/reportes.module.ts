import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsignacionProyecto } from '../asignaciones/asignacion-proyecto.entity.js';
import { MaterialProyecto } from '../materiales/material-proyecto.entity.js';
import { LiquidacionNomina } from '../nomina/nomina.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import {
  RegistroHoras,
  RegistroHorasDetalle,
} from '../registro-horas/registro-horas.entity.js';
import { TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { DashboardService } from './dashboard.service.js';
import { HorasCosteadasService } from './horas-costeadas.service.js';
import { ReportesController } from './reportes.controller.js';
import { ReportesService } from './reportes.service.js';

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
      MaterialProyecto,
    ]),
  ],
  controllers: [ReportesController],
  providers: [HorasCosteadasService, ReportesService, DashboardService],
})
export class ReportesModule {}
