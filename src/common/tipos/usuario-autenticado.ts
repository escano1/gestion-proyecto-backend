import type { Rol } from '../enums/rol.enum.js';

export interface UsuarioAutenticado {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
}
