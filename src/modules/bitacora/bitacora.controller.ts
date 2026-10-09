import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { BitacoraService } from './bitacora.service.js';
import { CrearEntradaDto, FiltroBitacoraDto } from './bitacora.dto.js';
import { CargaArchivos } from './carga-archivos.js';
import { type ArchivoCargado, construirContentDisposition } from './adjuntos.js';

@Controller()
export class BitacoraController {
  constructor(private readonly bitacora: BitacoraService) {}

  @Get('proyectos/:proyectoId/bitacora')
  listar(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Query() filtro: FiltroBitacoraDto,
  ) {
    return this.bitacora.listar(proyectoId, filtro);
  }

  @Post('proyectos/:proyectoId/bitacora')
  @Roles(Rol.GESTOR_PROYECTOS)
  @CargaArchivos()
  crear(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: CrearEntradaDto,
    @UploadedFiles() archivos: ArchivoCargado[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.bitacora.crear(proyectoId, dto, archivos ?? [], usuario);
  }

  @Post('bitacora/:id/adjuntos')
  @Roles(Rol.GESTOR_PROYECTOS)
  @CargaArchivos()
  agregarAdjuntos(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() archivos: ArchivoCargado[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.bitacora.agregarAdjuntos(id, archivos ?? [], usuario);
  }

  @Delete('bitacora/:id')
  @HttpCode(204)
  @Roles(Rol.GESTOR_PROYECTOS)
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.bitacora.eliminar(id, usuario);
  }

  @Get('bitacora/adjuntos/:id')
  // El MIME lo declaró quien subió el archivo: impide que el navegador lo reinterprete.
  @Header('X-Content-Type-Options', 'nosniff')
  async descargarAdjunto(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    const adjunto = await this.bitacora.obtenerAdjunto(id);
    return new StreamableFile(adjunto.contenido, {
      type: adjunto.mimeType,
      disposition: construirContentDisposition(adjunto.nombreArchivo, adjunto.mimeType),
      length: adjunto.contenido.length,
    });
  }

  @Delete('bitacora/adjuntos/:id')
  @HttpCode(204)
  @Roles(Rol.GESTOR_PROYECTOS)
  async eliminarAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.bitacora.eliminarAdjunto(id, usuario);
  }
}
