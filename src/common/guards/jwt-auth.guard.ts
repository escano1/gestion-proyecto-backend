import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ES_PUBLICO } from '../decorators/publico.decorator.js';
import type { UsuarioAutenticado } from '../tipos/usuario-autenticado.js';
import type { Rol } from '../enums/rol.enum.js';

export interface PayloadAcceso {
  sub: number;
  email: string;
  nombre: string;
  rol: Rol;
  tipo: 'acceso';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (esPublico) return true;

    const request = ctx
      .switchToHttp()
      .getRequest<Request & { usuario?: UsuarioAutenticado }>();
    const [esquema, token] = request.headers.authorization?.split(' ') ?? [];
    if (esquema !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    let payload: PayloadAcceso;
    try {
      payload = await this.jwt.verifyAsync<PayloadAcceso>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    if (payload.tipo !== 'acceso') {
      throw new UnauthorizedException('Token inválido');
    }

    request.usuario = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol,
    };
    return true;
  }
}
