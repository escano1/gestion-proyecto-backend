import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { UsuariosService } from './usuarios.service.js';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './usuarios.dto.js';

@Controller('usuarios')
@Roles(Rol.ADMIN)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.usuarios.crear(dto, usuario);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.usuarios.actualizar(id, dto, usuario);
  }
}
