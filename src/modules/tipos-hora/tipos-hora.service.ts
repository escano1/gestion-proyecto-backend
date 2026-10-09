import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoHora } from './tipo-hora.entity.js';
import { recargoTipoHora } from './recargos.js';
import { ParametrosService } from '../parametros/parametros.service.js';
import { hoyColombia } from '../../common/utils/fechas.js';

@Injectable()
export class TiposHoraService {
  constructor(
    @InjectRepository(TipoHora)
    private readonly repositorio: Repository<TipoHora>,
    private readonly parametros: ParametrosService,
  ) {}

  /** Tipos de hora con el recargo legal vigente en la fecha indicada. */
  async listar(fecha: string = hoyColombia()) {
    const [tipos, resolutor] = await Promise.all([
      this.repositorio.find({ order: { orden: 'ASC' } }),
      this.parametros.crearResolutor(),
    ]);
    const vigentes = resolutor.en(fecha);
    return tipos.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      nombre: t.nombre,
      descripcion: t.descripcion,
      esExtra: t.esExtra,
      esNocturna: t.esNocturna,
      esDominicalFestiva: t.esDominicalFestiva,
      orden: t.orden,
      activo: t.activo,
      recargo: recargoTipoHora(t, vigentes).toNumber(),
    }));
  }
}
