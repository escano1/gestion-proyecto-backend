import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { ParametrosService } from './parametros.service.js';
import { CrearParametroDto, FechaOpcionalDto } from './parametros.dto.js';

@Controller('parametros')
export class ParametrosController {
  constructor(private readonly parametros: ParametrosService) {}

  @Get()
  listar() {
    return this.parametros.listar();
  }

  @Get('catalogo')
  catalogo() {
    return this.parametros.catalogo();
  }

  @Get('vigentes')
  vigentes(@Query() { fecha }: FechaOpcionalDto) {
    return this.parametros.vigentes(fecha);
  }

  @Post()
  @Roles(Rol.NOMINA)
  crear(@Body() dto: CrearParametroDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.parametros.crear(dto, usuario);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Rol.NOMINA)
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.parametros.eliminar(id, usuario);
  }
}
