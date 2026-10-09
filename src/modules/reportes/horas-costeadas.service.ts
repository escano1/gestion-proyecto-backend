import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import type { Fecha } from '../../common/utils/fechas.js';
import { ParametrosService } from '../parametros/parametros.service.js';
import {
  aHorasPorDia,
  type AlertaHoras,
  alertasEnRango,
  evaluarAlertas,
  semanasQueCubren,
} from '../registro-horas/alertas-horas.js';
import {
  consultarHorasAgregadas,
  type FilaHorasAgregada,
  type FiltroHorasAgregadas,
} from '../registro-horas/consulta-horas.js';
import { TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { costearHoras, type FilaCosteada } from './costos.js';

export interface HorasCosteadas {
  filas: FilaCosteada[];
  tipos: ReadonlyMap<number, TipoHora>;
  trabajadores: ReadonlyMap<number, Trabajador>;
}

/** Fuente de datos de horas para los reportes: filas agregadas, costo y alertas. */
@Injectable()
export class HorasCosteadasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly parametros: ParametrosService,
    @InjectRepository(TipoHora)
    private readonly tiposHora: Repository<TipoHora>,
    @InjectRepository(Trabajador)
    private readonly trabajadores: Repository<Trabajador>,
  ) {}

  async consultar(filtro: FiltroHorasAgregadas): Promise<HorasCosteadas> {
    const filas = await consultarHorasAgregadas(this.dataSource, filtro);
    const tipos = await this.cargarTipos();
    if (filas.length === 0)
      return { filas: [], tipos, trabajadores: new Map() };

    const [trabajadores, resolutor] = await Promise.all([
      this.cargarTrabajadores(filas),
      this.parametros.crearResolutor(),
    ]);
    return {
      filas: costearHoras(filas, trabajadores, tipos, resolutor),
      tipos,
      trabajadores,
    };
  }

  /** Alertas del rango evaluadas sobre semanas completas (los límites semanales no se cortan). */
  async alertas(desde: Fecha, hasta: Fecha): Promise<AlertaHoras[]> {
    const filas = await consultarHorasAgregadas(
      this.dataSource,
      semanasQueCubren(desde, hasta),
    );
    if (filas.length === 0) return [];

    const [tipos, trabajadores, resolutor] = await Promise.all([
      this.cargarTipos(),
      this.cargarTrabajadores(filas),
      this.parametros.crearResolutor(),
    ]);
    const nombres = new Map(
      [...trabajadores.values()].map((t) => [t.id, t.nombre]),
    );
    return alertasEnRango(
      evaluarAlertas(aHorasPorDia(filas, tipos, nombres), resolutor),
      desde,
      hasta,
    );
  }

  private async cargarTipos(): Promise<Map<number, TipoHora>> {
    const tipos = await this.tiposHora.find({ order: { orden: 'ASC' } });
    return new Map(tipos.map((t) => [t.id, t]));
  }

  private async cargarTrabajadores(
    filas: FilaHorasAgregada[],
  ): Promise<Map<number, Trabajador>> {
    const ids = [...new Set(filas.map((f) => f.trabajadorId))];
    const trabajadores = await this.trabajadores.findBy({ id: In(ids) });
    return new Map(trabajadores.map((t) => [t.id, t]));
  }
}
