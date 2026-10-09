import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../enums/rol.enum.js';

export const ROLES = 'roles';
/** Restringe el endpoint a los roles indicados. ADMIN siempre tiene acceso. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);
