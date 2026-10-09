import { BadRequestException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { restriccionAutoEdicion, UsuariosService } from './usuarios.service.js';
import type { Usuario } from './usuario.entity.js';
import type { AuditoriaService } from '../auditoria/auditoria.service.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';

const admin: UsuarioAutenticado = { id: 1, email: 'admin@x.co', nombre: 'Admin', rol: Rol.ADMIN };

describe('restriccionAutoEdicion', () => {
  it('impide que el admin se desactive a sí mismo', () => {
    expect(restriccionAutoEdicion(1, { activo: false }, admin)).toBe(
      'No puede desactivar su propio usuario',
    );
  });

  it('impide que el admin se quite el rol ADMIN', () => {
    expect(restriccionAutoEdicion(1, { rol: Rol.CONSULTA }, admin)).toBe(
      'No puede quitarse a sí mismo el rol de administrador',
    );
  });

  it('permite cambios inocuos sobre sí mismo', () => {
    expect(restriccionAutoEdicion(1, { activo: true, rol: Rol.ADMIN }, admin)).toBeNull();
  });

  it('permite desactivar o cambiar el rol de otro usuario', () => {
    expect(restriccionAutoEdicion(2, { activo: false, rol: Rol.CONSULTA }, admin)).toBeNull();
  });
});

describe('UsuariosService.actualizar', () => {
  it('rechaza la auto-desactivación antes de tocar la base de datos', async () => {
    const transaction = vi.fn();
    const servicio = new UsuariosService(
      {} as Repository<Usuario>,
      { transaction } as unknown as DataSource,
      {} as AuditoriaService,
    );
    await expect(servicio.actualizar(1, { activo: false }, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
