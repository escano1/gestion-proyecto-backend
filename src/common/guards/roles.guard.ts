import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES } from '../decorators/roles.decorator.js';
import { Rol } from '../enums/rol.enum.js';
import type { UsuarioAutenticado } from '../tipos/usuario-autenticado.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<Rol[] | undefined>(
      ROLES,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!requeridos?.length) return true;

    const usuario = ctx
      .switchToHttp()
      .getRequest<{ usuario?: UsuarioAutenticado }>().usuario;
    if (!usuario) return true; // endpoint público: JwtAuthGuard ya decidió

    if (usuario.rol === Rol.ADMIN || requeridos.includes(usuario.rol)) {
      return true;
    }
    throw new ForbiddenException('No tiene permisos para esta operación');
  }
}
