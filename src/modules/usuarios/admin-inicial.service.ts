import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './usuario.entity.js';
import { UsuariosService } from './usuarios.service.js';
import { erroresPoliticaPassword, normalizarEmail } from './credenciales.js';
import { Rol } from '../../common/enums/rol.enum.js';

/** Crea el primer ADMIN desde variables de entorno cuando la tabla de usuarios está vacía. */
@Injectable()
export class AdminInicialService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminInicialService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly repositorio: Repository<Usuario>,
    private readonly usuarios: UsuariosService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.repositorio.count()) > 0) return;

    const email = this.config.get<string>('ADMIN_EMAIL')?.trim();
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn(
        'No hay usuarios registrados y faltan ADMIN_EMAIL/ADMIN_PASSWORD: no se creó el administrador inicial',
      );
      return;
    }
    const errores = erroresPoliticaPassword(password);
    if (errores.length) {
      this.logger.error(`ADMIN_PASSWORD no cumple la política de contraseñas: ${errores.join('; ')}`);
      return;
    }

    try {
      const admin = await this.usuarios.crear(
        {
          nombre: this.config.get<string>('ADMIN_NOMBRE')?.trim() || 'Administrador',
          email: normalizarEmail(email),
          password,
          rol: Rol.ADMIN,
        },
        null,
        'Administrador inicial creado desde variables de entorno',
      );
      this.logger.log(`Administrador inicial creado: ${admin.email}`);
    } catch (error) {
      // Otra instancia pudo crearlo al mismo tiempo; no debe impedir el arranque.
      this.logger.error(
        `No se pudo crear el administrador inicial: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
