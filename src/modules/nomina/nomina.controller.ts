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
  StreamableFile,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { CrearLiquidacionDto, FiltroLiquidacionesDto } from './nomina.dto.js';
import type {
  Desprendible,
  LiquidacionConNominas,
  LiquidacionResumen,
} from './nomina.respuestas.js';
import { NominaService, type ArchivoGenerado } from './nomina.service.js';

function descarga({ contenido, nombre, tipo }: ArchivoGenerado): StreamableFile {
  return new StreamableFile(contenido, {
    type: tipo,
    disposition: `attachment; filename="${nombre}"`,
    length: contenido.length,
  });
}

@Controller('nomina')
@Roles(Rol.NOMINA)
export class NominaController {
  constructor(private readonly nomina: NominaService) {}

  @Get('liquidaciones')
  listar(@Query() { anio }: FiltroLiquidacionesDto): Promise<LiquidacionResumen[]> {
    return this.nomina.listar(anio);
  }

  @Post('liquidaciones')
  crear(
    @Body() dto: CrearLiquidacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<LiquidacionConNominas> {
    return this.nomina.crear(dto, usuario);
  }

  @Get('liquidaciones/:id')
  obtener(@Param('id', ParseIntPipe) id: number): Promise<LiquidacionConNominas> {
    return this.nomina.obtener(id);
  }

  @Post('liquidaciones/:id/recalcular')
  @HttpCode(200)
  recalcular(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<LiquidacionConNominas> {
    return this.nomina.recalcular(id, usuario);
  }

  @Post('liquidaciones/:id/cerrar')
  @HttpCode(200)
  cerrar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<LiquidacionConNominas> {
    return this.nomina.cerrar(id, usuario);
  }

  // Solo ADMIN: @Roles() vacío dejaría pasar a cualquier rol (RolesGuard lo trata como público).
  @Post('liquidaciones/:id/reabrir')
  @HttpCode(200)
  @Roles(Rol.ADMIN)
  reabrir(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<LiquidacionConNominas> {
    return this.nomina.reabrir(id, usuario);
  }

  @Delete('liquidaciones/:id')
  @HttpCode(204)
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.nomina.eliminar(id, usuario);
  }

  @Get('liquidaciones/:id/excel')
  async excel(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    return descarga(await this.nomina.exportarExcel(id));
  }

  @Get('liquidaciones/:id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    return descarga(await this.nomina.exportarPdf(id));
  }

  @Get('desprendibles/:id')
  desprendible(@Param('id', ParseIntPipe) id: number): Promise<Desprendible> {
    return this.nomina.desprendible(id);
  }

  @Get('desprendibles/:id/pdf')
  async desprendiblePdf(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    return descarga(await this.nomina.exportarDesprendiblePdf(id));
  }
}
