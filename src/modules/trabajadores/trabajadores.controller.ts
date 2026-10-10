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
import { TrabajadoresService } from './trabajadores.service.js';
import {
  ActualizarTrabajadorDto,
  CrearTrabajadorDto,
  FiltroTrabajadoresDto,
} from './trabajadores.dto.js';

@Controller('trabajadores')
export class TrabajadoresController {
  constructor(private readonly trabajadores: TrabajadoresService) {}

  @Get()
  listar(@Query() filtro: FiltroTrabajadoresDto) {
    return this.trabajadores.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.trabajadores.obtener(id);
  }

  @Post()
  @Roles(Rol.NOMINA)
  crear(@Body() dto: CrearTrabajadorDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.trabajadores.crear(dto, usuario);
  }

  @Patch(':id')
  @Roles(Rol.NOMINA)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarTrabajadorDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.trabajadores.actualizar(id, dto, usuario);
  }

  @Delete(':id')
  @Roles(Rol.NOMINA)
  @HttpCode(204)
  eliminar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.trabajadores.eliminar(id, usuario);
  }
}
