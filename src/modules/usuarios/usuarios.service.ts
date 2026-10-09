import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Usuario } from './usuario.entity.js';
import { aUsuarioRespuesta, type UsuarioRespuesta } from './usuario-respuesta.js';
import { hashearPassword } from './credenciales.js';
import type { ActualizarUsuarioDto, CrearUsuarioDto } from './usuarios.dto.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';

/** Un administrador no puede desactivarse ni quitarse el rol ADMIN a sí mismo. */
export function restriccionAutoEdicion(
  id: number,
  cambios: Pick<ActualizarUsuarioDto, 'activo' | 'rol'>,
  actor: UsuarioAutenticado,
): string | null {
  if (id !== actor.id) return null;
  if (cambios.activo === false) return 'No puede desactivar su propio usuario';
  if (cambios.rol !== undefined && cambios.rol !== Rol.ADMIN) {
    return 'No puede quitarse a sí mismo el rol de administrador';
  }
  return null;
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly repositorio: Repository<Usuario>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<UsuarioRespuesta[]> {
    const usuarios = await this.repositorio.find({ order: { nombre: 'ASC', id: 'ASC' } });
    return usuarios.map(aUsuarioRespuesta);
  }

  /** `actor` es null cuando lo crea el sistema (administrador inicial). */
  async crear(
    dto: CrearUsuarioDto,
    actor: UsuarioAutenticado | null,
    descripcion?: string,
  ): Promise<UsuarioRespuesta> {
    const passwordHash = await hashearPassword(dto.password);
    return this.dataSource.transaction(async (m) => {
      if (await m.existsBy(Usuario, { email: dto.email })) {
        throw new ConflictException('Ya existe un usuario con ese email');
      }
      const usuario = await m.save(
        m.create(Usuario, {
          nombre: dto.nombre,
          email: dto.email,
          rol: dto.rol,
          activo: true,
          passwordHash,
        }),
      );
      await this.auditoria.registrar(
        {
          entidad: 'Usuario',
          entidadId: usuario.id,
          accion: AccionAuditoria.CREAR,
          despues: usuario,
          descripcion,
          usuario: actor,
        },
        m,
      );
      return aUsuarioRespuesta(usuario);
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarUsuarioDto,
    actor: UsuarioAutenticado,
  ): Promise<UsuarioRespuesta> {
    const restriccion = restriccionAutoEdicion(id, dto, actor);
    if (restriccion) throw new BadRequestException(restriccion);

    const passwordHash = dto.password ? await hashearPassword(dto.password) : undefined;
    return this.dataSource.transaction(async (m) => {
      const usuario = await m.findOneBy(Usuario, { id });
      if (!usuario) throw new NotFoundException('Usuario no encontrado');

      const antes = structuredClone(usuario);
      m.merge(Usuario, usuario, {
        nombre: dto.nombre,
        rol: dto.rol,
        activo: dto.activo,
        passwordHash,
      });
      const guardado = await m.save(usuario);
      await this.auditoria.registrar(
        {
          entidad: 'Usuario',
          entidadId: id,
          accion: AccionAuditoria.ACTUALIZAR,
          antes,
          despues: guardado,
          descripcion: passwordHash ? 'Incluye cambio de contraseña' : undefined,
          usuario: actor,
        },
        m,
      );
      return aUsuarioRespuesta(guardado);
    });
  }
}
