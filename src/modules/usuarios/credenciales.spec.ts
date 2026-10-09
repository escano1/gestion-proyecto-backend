import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  erroresPoliticaPassword,
  hashearPassword,
  normalizarEmail,
  verificarPassword,
} from './credenciales.js';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './usuarios.dto.js';
import { Rol } from '../../common/enums/rol.enum.js';

describe('erroresPoliticaPassword', () => {
  it.each(['Clave123', 'abcdefg1', 'contraseña9', '12345678a'])('acepta %s', (password) => {
    expect(erroresPoliticaPassword(password)).toEqual([]);
  });

  it('exige mínimo 8 caracteres', () => {
    expect(erroresPoliticaPassword('Abc1234')).toEqual([
      'La contraseña debe tener al menos 8 caracteres',
    ]);
  });

  it('exige al menos una letra', () => {
    expect(erroresPoliticaPassword('12345678')).toEqual([
      'La contraseña debe contener al menos una letra',
    ]);
  });

  it('exige al menos un número', () => {
    expect(erroresPoliticaPassword('abcdefgh')).toEqual([
      'La contraseña debe contener al menos un número',
    ]);
  });

  it('acumula todos los incumplimientos', () => {
    expect(erroresPoliticaPassword('')).toHaveLength(3);
  });

  it('rechaza claves de más de 72 bytes (bcrypt las truncaría)', () => {
    expect(erroresPoliticaPassword(`a1${'x'.repeat(71)}`)).toEqual([
      'La contraseña no puede superar 72 caracteres',
    ]);
  });
});

describe('normalizarEmail', () => {
  it('quita espacios y pasa a minúsculas', () => {
    expect(normalizarEmail('  Admin@Empresa.COM ')).toBe('admin@empresa.com');
  });
});

describe('hashearPassword / verificarPassword', () => {
  it('genera un hash bcrypt de costo 10 verificable', async () => {
    const hash = await hashearPassword('Clave123');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    await expect(verificarPassword('Clave123', hash)).resolves.toBe(true);
    await expect(verificarPassword('Clave124', hash)).resolves.toBe(false);
  });
});

describe('DTOs de usuario', () => {
  const errores = async <T extends object>(clase: new () => T, datos: object) =>
    (await validate(plainToInstance(clase, datos))).map((e) => e.property);

  it('normaliza el email y valida la política al crear', async () => {
    const dto = plainToInstance(CrearUsuarioDto, {
      nombre: '  Ana  ',
      email: ' ANA@Empresa.com ',
      password: 'Clave123',
      rol: Rol.NOMINA,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.email).toBe('ana@empresa.com');
    expect(dto.nombre).toBe('Ana');
  });

  it('rechaza una clave débil con el mensaje de la política', async () => {
    const [error] = await validate(
      plainToInstance(CrearUsuarioDto, {
        nombre: 'Ana',
        email: 'ana@empresa.com',
        password: 'corta',
        rol: Rol.NOMINA,
      }),
    );
    expect(error.property).toBe('password');
    expect(Object.values(error.constraints ?? {})[0]).toContain('al menos 8 caracteres');
  });

  it('en la edición permite omitir campos pero no enviarlos en null', async () => {
    expect(await errores(ActualizarUsuarioDto, {})).toEqual([]);
    expect((await errores(ActualizarUsuarioDto, { nombre: null, activo: null })).sort()).toEqual([
      'activo',
      'nombre',
    ]);
    expect(await errores(ActualizarUsuarioDto, { password: 'sinnumero' })).toEqual(['password']);
    const conEmail = await validate(plainToInstance(ActualizarUsuarioDto, { email: 'otro@x.co' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(conEmail.map((e) => e.property)).toEqual(['email']);
  });
});
