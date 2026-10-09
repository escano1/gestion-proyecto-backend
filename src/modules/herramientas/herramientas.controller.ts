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
import { HerramientasService } from './herramientas.service.js';
import {
  ActualizarHerramientaDto,
  CrearHerramientaDto,
  FiltroHerramientasDto,
} from './herramientas.dto.js';

@Controller()
export class HerramientasController {
  constructor(private readonly herramientas: HerramientasService) {}

  @Get('proyectos/:proyectoId/herramientas')
  listar(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Query() filtro: FiltroHerramientasDto,
  ) {
    return this.herramientas.listar(proyectoId, filtro);
  }

  @Post('proyectos/:proyectoId/herramientas')
  @Roles(Rol.GESTOR_PROYECTOS)
  crear(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: CrearHerramientaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.herramientas.crear(proyectoId, dto, usuario);
  }

  @Patch('herramientas/:id')
  @Roles(Rol.GESTOR_PROYECTOS)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarHerramientaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.herramientas.actualizar(id, dto, usuario);
  }

  @Delete('herramientas/:id')
  @HttpCode(204)
  @Roles(Rol.GESTOR_PROYECTOS)
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.herramientas.eliminar(id, usuario);
  }
}
