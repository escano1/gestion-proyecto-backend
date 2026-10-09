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
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { HitosService } from './hitos.service.js';
import { ActualizarHitoDto, CrearHitoDto } from './hitos.dto.js';

@Controller()
export class HitosController {
  constructor(private readonly hitos: HitosService) {}

  @Get('proyectos/:proyectoId/hitos')
  listar(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.hitos.listar(proyectoId);
  }

  @Get('proyectos/:proyectoId/avance')
  avance(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.hitos.avance(proyectoId);
  }

  @Post('proyectos/:proyectoId/hitos')
  @Roles(Rol.GESTOR_PROYECTOS)
  crear(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: CrearHitoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.hitos.crear(proyectoId, dto, usuario);
  }

  @Patch('hitos/:id')
  @Roles(Rol.GESTOR_PROYECTOS)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarHitoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.hitos.actualizar(id, dto, usuario);
  }

  @Delete('hitos/:id')
  @HttpCode(204)
  @Roles(Rol.GESTOR_PROYECTOS)
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.hitos.eliminar(id, usuario);
  }
}
