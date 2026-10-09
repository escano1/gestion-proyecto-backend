import {
  Body,
  Controller,
  Get,
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
import { ProyectosService } from './proyectos.service.js';
import {
  ActualizarProyectoDto,
  CrearProyectoDto,
  FiltroProyectosDto,
} from './proyectos.dto.js';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectos: ProyectosService) {}

  @Get()
  listar(@Query() filtro: FiltroProyectosDto) {
    return this.proyectos.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.proyectos.obtener(id);
  }

  @Post()
  @Roles(Rol.GESTOR_PROYECTOS)
  crear(@Body() dto: CrearProyectoDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.proyectos.crear(dto, usuario);
  }

  @Patch(':id')
  @Roles(Rol.GESTOR_PROYECTOS)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProyectoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.proyectos.actualizar(id, dto, usuario);
  }
}
