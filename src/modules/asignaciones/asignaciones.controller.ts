import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { AsignacionesService } from './asignaciones.service.js';
import {
  ActualizarAsignacionDto,
  CrearAsignacionDto,
  FiltroAsignacionesDto,
} from './asignaciones.dto.js';

// Sin prefijo: también expone /trabajadores/:id/asignaciones.
@Controller()
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Get('asignaciones')
  listar(@Query() filtro: FiltroAsignacionesDto) {
    return this.asignaciones.listar(filtro);
  }

  @Get('trabajadores/:id/asignaciones')
  historialTrabajador(@Param('id', ParseIntPipe) id: number) {
    return this.asignaciones.historialTrabajador(id);
  }

  @Post('asignaciones')
  @Roles(Rol.GESTOR_PROYECTOS)
  crear(@Body() dto: CrearAsignacionDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.asignaciones.crear(dto, usuario);
  }

  @Patch('asignaciones/:id')
  @Roles(Rol.GESTOR_PROYECTOS)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAsignacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.asignaciones.actualizar(id, dto, usuario);
  }

  @Delete('asignaciones/:id')
  @HttpCode(204)
  @Roles(Rol.GESTOR_PROYECTOS)
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.asignaciones.eliminar(id, usuario);
  }
}
