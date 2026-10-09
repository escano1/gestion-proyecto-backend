import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { aExpiracion, AuthService, CREDENCIALES_INVALIDAS } from './auth.service.js';
import type { Usuario } from '../usuarios/usuario.entity.js';
import { hashearPassword, verificarPassword } from '../usuarios/credenciales.js';
import type { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { PayloadAcceso } from '../../common/guards/jwt-auth.guard.js';
import { Rol } from '../../common/enums/rol.enum.js';

const SECRETO = 'secreto-de-acceso-de-prueba-con-32-caracteres';
const SECRETO_REFRESH = 'secreto-de-refresco-de-prueba-con-32-caracteres';
const PASSWORD = 'Clave123';

function crearEntorno(usuario: Partial<Usuario> | null) {
  const repositorio = {
    findOne: vi.fn().mockResolvedValue(usuario),
    findOneBy: vi.fn().mockResolvedValue(usuario),
  };
  const manager = { update: vi.fn().mockResolvedValue(undefined) };
  const dataSource = {
    transaction: vi.fn((trabajo: (m: EntityManager) => Promise<unknown>) =>
      trabajo(manager as unknown as EntityManager),
    ),
  };
  const auditoria = { registrar: vi.fn().mockResolvedValue(undefined) };
  const valores: Record<string, string> = {
    JWT_SECRET: SECRETO,
    JWT_REFRESH_SECRET: SECRETO_REFRESH,
  };
  const config = {
    get: (clave: string) => valores[clave],
    getOrThrow: (clave: string) => valores[clave],
  };
  const jwt = new JwtService();
  const servicio = new AuthService(
    repositorio as unknown as Repository<Usuario>,
    jwt,
    config as unknown as ConfigService,
    dataSource as unknown as DataSource,
    auditoria as unknown as AuditoriaService,
  );
  return { servicio, repositorio, manager, auditoria, jwt };
}

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await hashearPassword(PASSWORD);
});

const usuarioActivo = (): Partial<Usuario> => ({
  id: 7,
  nombre: 'Ana Gómez',
  email: 'ana@empresa.com',
  rol: Rol.NOMINA,
  activo: true,
  creadoEn: new Date('2026-01-01T00:00:00Z'),
  actualizadoEn: new Date('2026-01-01T00:00:00Z'),
  passwordHash,
});

describe('AuthService.login', () => {
  it('emite tokens de acceso y refresco y no expone el hash', async () => {
    const { servicio, repositorio, jwt } = crearEntorno(usuarioActivo());
    const sesion = await servicio.login({ email: ' ANA@empresa.com ', password: PASSWORD });

    expect(repositorio.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'ana@empresa.com' } }),
    );
    expect(sesion.usuario).toEqual({
      id: 7,
      nombre: 'Ana Gómez',
      email: 'ana@empresa.com',
      rol: Rol.NOMINA,
      activo: true,
      creadoEn: new Date('2026-01-01T00:00:00Z'),
    });

    const acceso = await jwt.verifyAsync<PayloadAcceso & { exp: number; iat: number }>(
      sesion.accessToken,
      { secret: SECRETO },
    );
    expect(acceso).toMatchObject({
      sub: 7,
      email: 'ana@empresa.com',
      nombre: 'Ana Gómez',
      rol: Rol.NOMINA,
      tipo: 'acceso',
    });
    expect(acceso.exp - acceso.iat).toBe(15 * 60);

    const refresh = await jwt.verifyAsync<{ sub: number; tipo: string; exp: number; iat: number }>(
      sesion.refreshToken,
      { secret: SECRETO_REFRESH },
    );
    expect(refresh).toMatchObject({ sub: 7, tipo: 'refresh' });
    expect(refresh.exp - refresh.iat).toBe(7 * 24 * 3600);
  });

  it.each([
    ['la clave no coincide', usuarioActivo(), 'Otra1234'],
    ['el usuario está inactivo', { ...usuarioActivo(), activo: false }, PASSWORD],
    ['el usuario no existe', null, PASSWORD],
  ])('responde 401 "Credenciales inválidas" si %s', async (_caso, usuario, password) => {
    const { servicio } = crearEntorno(usuario);
    await expect(servicio.login({ email: 'ana@empresa.com', password })).rejects.toThrow(
      new UnauthorizedException(CREDENCIALES_INVALIDAS),
    );
  });
});

describe('AuthService.refrescar', () => {
  it('emite un par nuevo con un refresh token válido', async () => {
    const { servicio } = crearEntorno(usuarioActivo());
    const { refreshToken } = await servicio.login({ email: 'ana@empresa.com', password: PASSWORD });
    const nueva = await servicio.refrescar(refreshToken);
    expect(nueva.usuario.id).toBe(7);
    expect(nueva.accessToken).toEqual(expect.any(String));
  });

  it('rechaza un access token usado como refresh', async () => {
    const { servicio } = crearEntorno(usuarioActivo());
    const { accessToken } = await servicio.login({ email: 'ana@empresa.com', password: PASSWORD });
    await expect(servicio.refrescar(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un token firmado con el secreto de refresco pero de otro tipo', async () => {
    const { servicio, jwt } = crearEntorno(usuarioActivo());
    const token = await jwt.signAsync({ sub: 7, tipo: 'acceso' }, { secret: SECRETO_REFRESH });
    await expect(servicio.refrescar(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un token expirado o alterado', async () => {
    const { servicio, jwt } = crearEntorno(usuarioActivo());
    const expirado = await jwt.signAsync(
      { sub: 7, tipo: 'refresh' },
      { secret: SECRETO_REFRESH, expiresIn: -10 },
    );
    await expect(servicio.refrescar(expirado)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(servicio.refrescar('no.es.un.jwt')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza si el usuario fue desactivado', async () => {
    const { servicio, jwt } = crearEntorno({ ...usuarioActivo(), activo: false });
    const token = await jwt.signAsync({ sub: 7, tipo: 'refresh' }, { secret: SECRETO_REFRESH });
    await expect(servicio.refrescar(token)).rejects.toThrow(
      new UnauthorizedException(CREDENCIALES_INVALIDAS),
    );
  });
});

describe('AuthService.cambiarPassword', () => {
  const actor = { id: 7, email: 'ana@empresa.com', nombre: 'Ana Gómez', rol: Rol.NOMINA };

  it('responde 400 si la clave actual no coincide', async () => {
    const { servicio, manager } = crearEntorno(usuarioActivo());
    await expect(
      servicio.cambiarPassword(actor, { passwordActual: 'Mala1234', passwordNueva: 'Nueva1234' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('guarda el nuevo hash y audita el cambio', async () => {
    const { servicio, manager, auditoria } = crearEntorno(usuarioActivo());
    await servicio.cambiarPassword(actor, { passwordActual: PASSWORD, passwordNueva: 'Nueva1234' });

    const [, criterio, cambios] = manager.update.mock.calls[0] as [
      unknown,
      { id: number },
      { passwordHash: string },
    ];
    expect(criterio).toEqual({ id: 7 });
    await expect(verificarPassword('Nueva1234', cambios.passwordHash)).resolves.toBe(true);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ entidad: 'Usuario', entidadId: 7, usuario: actor }),
      manager,
    );
  });
});

describe('aExpiracion', () => {
  it('interpreta números puros como segundos y conserva las unidades', () => {
    expect(aExpiracion('900')).toBe(900);
    expect(aExpiracion('15m')).toBe('15m');
  });
});
