import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Publico } from '../../common/decorators/publico.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { AuthService } from './auth.service.js';
import { CambiarPasswordDto, LoginDto, RefreshDto } from './auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @Publico()
  @HttpCode(200)
  refrescar(@Body() { refreshToken }: RefreshDto) {
    return this.auth.refrescar(refreshToken);
  }

  @Get('me')
  perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.auth.perfil(usuario);
  }

  @Patch('password')
  @HttpCode(204)
  async cambiarPassword(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarPasswordDto,
  ): Promise<void> {
    await this.auth.cambiarPassword(usuario, dto);
  }
}
