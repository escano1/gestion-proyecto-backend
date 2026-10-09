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
import { MaterialesService } from './materiales.service.js';
import {
  ActualizarMaterialDto,
  CrearMaterialDto,
  FiltroMaterialesDto,
} from './materiales.dto.js';

@Controller()
export class MaterialesController {
  constructor(private readonly materiales: MaterialesService) {}

  @Get('proyectos/:proyectoId/materiales')
  listar(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Query() filtro: FiltroMaterialesDto,
  ) {
    return this.materiales.listar(proyectoId, filtro);
  }

  @Post('proyectos/:proyectoId/materiales')
  @Roles(Rol.GESTOR_PROYECTOS)
  crear(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: CrearMaterialDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.materiales.crear(proyectoId, dto, usuario);
  }

  @Patch('materiales/:id')
  @Roles(Rol.GESTOR_PROYECTOS)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarMaterialDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.materiales.actualizar(id, dto, usuario);
  }

  @Delete('materiales/:id')
  @HttpCode(204)
  @Roles(Rol.GESTOR_PROYECTOS)
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.materiales.eliminar(id, usuario);
  }
}
