import type { Rol } from '../../common/enums/rol.enum.js';
import type { Usuario } from './usuario.entity.js';

/** Forma pública del usuario (contrato `Usuario`): nunca expone el hash. */
export interface UsuarioRespuesta {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creadoEn: Date;
}

export function aUsuarioRespuesta(usuario: Usuario): UsuarioRespuesta {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo,
    creadoEn: usuario.creadoEn,
  };
}
