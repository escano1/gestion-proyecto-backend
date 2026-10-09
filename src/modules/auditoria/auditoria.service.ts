import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import {
  AccionAuditoria,
  RegistroAuditoria,
} from './registro-auditoria.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import type { Pagina } from '../../common/dto/paginacion.dto.js';
import type { FiltroAuditoriaDto } from './filtro-auditoria.dto.js';

export interface EntradaAuditoria {
  entidad: string;
  entidadId: number | string;
  accion: AccionAuditoria;
  antes?: unknown;
  despues?: unknown;
  descripcion?: string;
  usuario?: UsuarioAutenticado | null;
}

const CAMPOS_EXCLUIDOS = new Set(['passwordHash', 'contenido']);

/** Copia serializable sin campos sensibles ni binarios. */
function instantanea(dato: unknown): Record<string, unknown> | null {
  if (dato === undefined || dato === null) return null;
  return JSON.parse(
    JSON.stringify(dato, (clave, valor: unknown) =>
      CAMPOS_EXCLUIDOS.has(clave) ? undefined : valor,
    ),
  );
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(RegistroAuditoria)
    private readonly repositorio: Repository<RegistroAuditoria>,
  ) {}

  /** Registra un cambio. Pasar `manager` para que quede dentro de la misma transacción. */
  async registrar(entrada: EntradaAuditoria, manager?: EntityManager): Promise<void> {
    const repositorio = manager?.getRepository(RegistroAuditoria) ?? this.repositorio;
    const registro = new RegistroAuditoria();
    registro.entidad = entrada.entidad;
    registro.entidadId = String(entrada.entidadId);
    registro.accion = entrada.accion;
    registro.datosAnteriores = instantanea(entrada.antes);
    registro.datosNuevos = instantanea(entrada.despues);
    registro.descripcion = entrada.descripcion ?? null;
    registro.usuarioId = entrada.usuario?.id ?? null;
    registro.usuarioEmail = entrada.usuario?.email ?? null;
    await repositorio.save(registro);
  }

  async listar(filtro: FiltroAuditoriaDto): Promise<Pagina<RegistroAuditoria>> {
    const consulta = this.repositorio
      .createQueryBuilder('a')
      .orderBy('a.fecha', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .skip((filtro.pagina - 1) * filtro.limite)
      .take(filtro.limite);

    if (filtro.entidad) consulta.andWhere('a.entidad = :entidad', { entidad: filtro.entidad });
    if (filtro.entidadId) consulta.andWhere('a.entidadId = :entidadId', { entidadId: filtro.entidadId });
    if (filtro.usuarioId) consulta.andWhere('a.usuarioId = :usuarioId', { usuarioId: filtro.usuarioId });
    if (filtro.accion) consulta.andWhere('a.accion = :accion', { accion: filtro.accion });
    if (filtro.desde) consulta.andWhere('a.fecha >= :desde', { desde: `${filtro.desde}T00:00:00-05:00` });
    if (filtro.hasta) consulta.andWhere('a.fecha <= :hasta', { hasta: `${filtro.hasta}T23:59:59.999-05:00` });

    const [datos, total] = await consulta.getManyAndCount();
    return { datos, total, pagina: filtro.pagina, limite: filtro.limite };
  }
}
