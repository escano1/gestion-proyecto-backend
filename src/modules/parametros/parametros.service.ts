import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { ParametroLegal } from './parametro-legal.entity.js';
import { CATALOGO_PARAMETROS } from './catalogo-parametros.js';
import {
  parametrosANumeros,
  ResolutorParametros,
} from './resolutor-parametros.js';
import type { CrearParametroDto } from './parametros.dto.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import {
  EstadoLiquidacion,
  LiquidacionNomina,
} from '../nomina/nomina.entity.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import { hoyColombia } from '../../common/utils/fechas.js';

@Injectable()
export class ParametrosService {
  constructor(
    @InjectRepository(ParametroLegal)
    private readonly repositorio: Repository<ParametroLegal>,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Carga todas las vigencias y devuelve un resolutor en memoria. */
  async crearResolutor(manager?: EntityManager): Promise<ResolutorParametros> {
    const repositorio =
      manager?.getRepository(ParametroLegal) ?? this.repositorio;
    return new ResolutorParametros(await repositorio.find());
  }

  catalogo() {
    return Object.values(CATALOGO_PARAMETROS);
  }

  async listar() {
    const filas = await this.repositorio.find({
      order: { codigo: 'ASC', vigenteDesde: 'DESC' },
    });
    return filas.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      nombre: CATALOGO_PARAMETROS[f.codigo]?.nombre ?? f.codigo,
      unidad: CATALOGO_PARAMETROS[f.codigo]?.unidad ?? 'FRACCION',
      valor: f.valor,
      vigenteDesde: f.vigenteDesde,
      norma: f.norma,
      creadoEn: f.creadoEn,
    }));
  }

  async vigentes(fecha: string = hoyColombia()) {
    const resolutor = await this.crearResolutor();
    return { fecha, valores: parametrosANumeros(resolutor.en(fecha)) };
  }

  async crear(
    dto: CrearParametroDto,
    usuario: UsuarioAutenticado,
  ): Promise<ParametroLegal> {
    return this.dataSource.transaction(async (m) => {
      const parametro = await m.save(
        m.create(ParametroLegal, {
          codigo: dto.codigo,
          valor: dto.valor,
          vigenteDesde: dto.vigenteDesde,
          norma: dto.norma ?? null,
          creadoPorId: usuario.id,
        }),
      );
      await this.marcarLiquidacionesParaRecalculo(m, dto.vigenteDesde);
      await this.auditoria.registrar(
        {
          entidad: 'ParametroLegal',
          entidadId: parametro.id,
          accion: AccionAuditoria.CREAR,
          despues: parametro,
          usuario,
        },
        m,
      );
      return parametro;
    });
  }

  async eliminar(id: number, usuario: UsuarioAutenticado): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const parametro = await m.findOneBy(ParametroLegal, { id });
      if (!parametro) throw new NotFoundException('Parámetro no encontrado');

      const cerradaAfectada = await m
        .getRepository(LiquidacionNomina)
        .createQueryBuilder('l')
        .where('l.estado = :estado', { estado: EstadoLiquidacion.CERRADA })
        .andWhere('l.fechaFin >= :desde', { desde: parametro.vigenteDesde })
        .getExists();
      if (cerradaAfectada) {
        throw new ConflictException(
          'No se puede eliminar: hay nóminas cerradas calculadas con esta vigencia',
        );
      }

      await m.delete(ParametroLegal, { id });
      await this.marcarLiquidacionesParaRecalculo(m, parametro.vigenteDesde);
      await this.auditoria.registrar(
        {
          entidad: 'ParametroLegal',
          entidadId: id,
          accion: AccionAuditoria.ELIMINAR,
          antes: parametro,
          usuario,
        },
        m,
      );
    });
  }

  private async marcarLiquidacionesParaRecalculo(
    m: EntityManager,
    desde: string,
  ) {
    await m
      .createQueryBuilder()
      .update(LiquidacionNomina)
      .set({ requiereRecalculo: true })
      .where('estado = :estado', { estado: EstadoLiquidacion.BORRADOR })
      .andWhere('fecha_fin >= :desde', { desde })
      .execute();
  }
}
