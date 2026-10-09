import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { DashboardService } from './dashboard.service.js';
import {
  AvanceProyectosDto,
  NominaPeriodosDto,
  RangoFechasDto,
  RangoOpcionalDto,
  ReporteHorasDto,
} from './reportes.dto.js';
import { ReportesService } from './reportes.service.js';

@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportes: ReportesService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get('horas')
  horas(@Query() consulta: ReporteHorasDto) {
    return this.reportes.horas(consulta);
  }

  @Get('costos-proyectos')
  costosProyectos(@Query() consulta: RangoFechasDto) {
    return this.reportes.costosProyectos(consulta);
  }

  @Get('alertas-horas-extra')
  alertasHorasExtra(@Query() consulta: RangoFechasDto) {
    return this.reportes.alertasHorasExtra(consulta);
  }

  @Get('nomina-periodos')
  @Roles(Rol.NOMINA)
  nominaPeriodos(@Query() { anio }: NominaPeriodosDto) {
    return this.reportes.nominaPeriodos(anio);
  }

  @Get('pendientes')
  pendientes() {
    return this.reportes.pendientes();
  }

  @Get('avance-proyectos')
  avanceProyectos(@Query() { estado }: AvanceProyectosDto) {
    return this.reportes.avanceProyectos(estado);
  }

  @Get('proyectos/:id/resumen')
  resumenProyecto(
    @Param('id', ParseIntPipe) id: number,
    @Query() rango: RangoOpcionalDto,
  ) {
    return this.reportes.resumenProyecto(id, rango);
  }

  @Get('dashboard')
  obtenerDashboard(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.dashboard.obtener(usuario);
  }
}
