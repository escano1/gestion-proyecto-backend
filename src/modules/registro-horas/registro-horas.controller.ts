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
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import {
  ActualizarRegistroHorasDto,
  CrearRegistroHorasDto,
  FiltroRegistroHorasDto,
  LoteRegistroHorasDto,
} from './registro-horas.dto.js';
import { RegistroHorasService } from './registro-horas.service.js';

@Controller('registro-horas')
export class RegistroHorasController {
  constructor(private readonly registroHoras: RegistroHorasService) {}

  @Get()
  listar(@Query() filtro: FiltroRegistroHorasDto) {
    return this.registroHoras.listar(filtro);
  }

  @Put('lote')
  @Roles(Rol.GESTOR_PROYECTOS, Rol.NOMINA)
  guardarLote(
    @Body() dto: LoteRegistroHorasDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.registroHoras.guardarLote(dto, usuario);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.registroHoras.obtener(id);
  }

  @Post()
  @Roles(Rol.GESTOR_PROYECTOS, Rol.NOMINA)
  crear(
    @Body() dto: CrearRegistroHorasDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.registroHoras.crear(dto, usuario);
  }

  @Patch(':id')
  @Roles(Rol.GESTOR_PROYECTOS, Rol.NOMINA)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarRegistroHorasDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.registroHoras.actualizar(id, dto, usuario);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Rol.GESTOR_PROYECTOS, Rol.NOMINA)
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.registroHoras.eliminar(id, usuario);
  }
}
