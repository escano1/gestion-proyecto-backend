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
  it.each(['admin', 'Clave123', 'abcdefg1', 'contraseña9', '12345678', 'a'])('acepta %s', (password) => {
    expect(erroresPoliticaPassword(password)).toEqual([]);
  });

  it('solo rechaza la contraseña vacía', () => {
    expect(erroresPoliticaPassword('')).toEqual(['La contraseña no puede estar vacía']);
  });

  it('rechaza claves de más de 72 bytes (bcrypt las truncaría)', () => {
    expect(erroresPoliticaPassword('x'.repeat(73))).toEqual([
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

  it('acepta "admin" como usuario y como contraseña', async () => {
    const dto = plainToInstance(CrearUsuarioDto, {
      nombre: 'Admin',
      email: ' Admin ',
      password: 'admin',
      rol: Rol.ADMIN,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.email).toBe('admin');
  });

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

  it('rechaza una contraseña vacía con el mensaje de la política', async () => {
    const [error] = await validate(
      plainToInstance(CrearUsuarioDto, {
        nombre: 'Ana',
        email: 'ana@empresa.com',
        password: '',
        rol: Rol.NOMINA,
      }),
    );
    expect(error.property).toBe('password');
    expect(Object.values(error.constraints ?? {})[0]).toContain('no puede estar vacía');
  });

  it('en la edición permite omitir campos pero no enviarlos en null', async () => {
    expect(await errores(ActualizarUsuarioDto, {})).toEqual([]);
    expect((await errores(ActualizarUsuarioDto, { nombre: null, activo: null })).sort()).toEqual([
      'activo',
      'nombre',
    ]);
    expect(await errores(ActualizarUsuarioDto, { password: '' })).toEqual(['password']);
    const conEmail = await validate(plainToInstance(ActualizarUsuarioDto, { email: 'otro@x.co' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(conEmail.map((e) => e.property)).toEqual(['email']);
  });
});
