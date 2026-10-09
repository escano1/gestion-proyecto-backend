import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type FindOptionsSelect, Repository } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity.js';
import { aUsuarioRespuesta, type UsuarioRespuesta } from '../usuarios/usuario-respuesta.js';
import {
  hashearPassword,
  normalizarEmail,
  verificarPassword,
} from '../usuarios/credenciales.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import type { PayloadAcceso } from '../../common/guards/jwt-auth.guard.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import type { CambiarPasswordDto, LoginDto } from './auth.dto.js';

export interface PayloadRefresh {
  sub: number;
  tipo: 'refresh';
}

export interface Sesion {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioRespuesta;
}

type Expiracion = NonNullable<JwtSignOptions['expiresIn']>;

export const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
const SESION_INVALIDA = 'Sesión inválida o expirada';

// Hash de una clave que nadie conoce: compara aunque el email no exista para no revelarlo por tiempo de respuesta.
const HASH_SENUELO = '$2b$10$1ox7dlxhEaDP.kVnMMc1iu9tncIdBxIbLgh5/aVdgxfh8wnJLh/ke';

const SELECCION_CON_HASH: FindOptionsSelect<Usuario> = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  creadoEn: true,
  actualizadoEn: true,
  passwordHash: true,
};

/** "900" para jsonwebtoken serían milisegundos; un número puro se interpreta como segundos. */
export function aExpiracion(valor: string): Expiracion {
  return /^\d+$/.test(valor) ? Number(valor) : (valor as Expiracion);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async login({ email, password }: LoginDto): Promise<Sesion> {
    const usuario = await this.usuarios.findOne({
      where: { email: normalizarEmail(email) },
      select: SELECCION_CON_HASH,
    });
    const coincide = await verificarPassword(password, usuario?.passwordHash ?? HASH_SENUELO);
    if (!usuario || !usuario.activo || !coincide) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }
    return this.emitirSesion(usuario);
  }

  async refrescar(refreshToken: string): Promise<Sesion> {
    let payload: PayloadRefresh;
    try {
      payload = await this.jwt.verifyAsync<PayloadRefresh>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(SESION_INVALIDA);
    }
    if (payload.tipo !== 'refresh' || !Number.isInteger(payload.sub)) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    const usuario = await this.usuarios.findOneBy({ id: payload.sub });
    if (!usuario?.activo) throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    return this.emitirSesion(usuario);
  }

  async perfil(actor: UsuarioAutenticado): Promise<UsuarioRespuesta> {
    const usuario = await this.usuarios.findOneBy({ id: actor.id });
    if (!usuario?.activo) throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    return aUsuarioRespuesta(usuario);
  }

  async cambiarPassword(actor: UsuarioAutenticado, dto: CambiarPasswordDto): Promise<void> {
    const usuario = await this.usuarios.findOne({
      where: { id: actor.id },
      select: SELECCION_CON_HASH,
    });
    if (!usuario?.activo) throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    if (!(await verificarPassword(dto.passwordActual, usuario.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const passwordHash = await hashearPassword(dto.passwordNueva);
    await this.dataSource.transaction(async (m) => {
      await m.update(Usuario, { id: usuario.id }, { passwordHash });
      await this.auditoria.registrar(
        {
          entidad: 'Usuario',
          entidadId: usuario.id,
          accion: AccionAuditoria.ACTUALIZAR,
          descripcion: 'Cambio de contraseña',
          usuario: actor,
        },
        m,
      );
    });
  }

  private async emitirSesion(usuario: Usuario): Promise<Sesion> {
    const acceso: PayloadAcceso = {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      tipo: 'acceso',
    };
    const refresh: PayloadRefresh = { sub: usuario.id, tipo: 'refresh' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(acceso, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: aExpiracion(this.config.get<string>('JWT_EXPIRES_IN') ?? '15m'),
      }),
      this.jwt.signAsync(refresh, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: aExpiracion(this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d'),
      }),
    ]);
    return { accessToken, refreshToken, usuario: aUsuarioRespuesta(usuario) };
  }
}
