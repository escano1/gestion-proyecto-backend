import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Rol } from '../../common/enums/rol.enum.js';
import type { UsuarioAutenticado } from '../../common/tipos/usuario-autenticado.js';
import {
  type Fecha,
  hoyColombia,
  primerDiaMes,
  ultimaFechaMes,
} from '../../common/utils/fechas.js';
import {
  EstadoHerramienta,
  HerramientaProyecto,
} from '../herramientas/herramienta-proyecto.entity.js';
import type { EstadoAvance } from '../hitos/avance.js';
import { MaterialProyecto } from '../materiales/material-proyecto.entity.js';
import { LiquidacionNomina } from '../nomina/nomina.entity.js';
import { EstadoProyecto, Proyecto } from '../proyectos/proyecto.entity.js';
import {
  EstadoTrabajador,
  Trabajador,
} from '../trabajadores/trabajador.entity.js';
import { resumirCostos } from './costos.js';
import { HorasCosteadasService } from './horas-costeadas.service.js';
import {
  aLiquidacionResumen,
  type LiquidacionResumen,
} from './reportes-respuesta.js';
import {
  desglosePorTipo,
  ESTADOS_MATERIAL_PENDIENTE,
  type HorasTipo,
  ReportesService,
} from './reportes.service.js';

const PROYECTOS_EN_GRAFICO = 8;

export interface Dashboard {
  fecha: Fecha;
  proyectosActivos: number;
  trabajadoresActivos: number;
  mes: {
    desde: Fecha;
    hasta: Fecha;
    horas: number;
    horasExtra: number;
    costo: number;
    porTipo: HorasTipo[];
  };
  costoPorProyecto: {
    proyectoId: number;
    codigo: string;
    nombre: string;
    horas: number;
    costo: number;
  }[];
  alertasHorasExtra: number;
  materialesPendientes: number;
  herramientasVencidas: number;
  avanceProyectos: {
    id: number;
    codigo: string;
    nombre: string;
    avanceReal: number;
    avancePlaneado: number;
    estado: EstadoAvance;
  }[];
  ultimaLiquidacion: LiquidacionResumen | null;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly reportes: ReportesService,
    private readonly horasCosteadas: HorasCosteadasService,
    @InjectRepository(Proyecto)
    private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Trabajador)
    private readonly trabajadores: Repository<Trabajador>,
    @InjectRepository(MaterialProyecto)
    private readonly materiales: Repository<MaterialProyecto>,
    @InjectRepository(HerramientaProyecto)
    private readonly herramientas: Repository<HerramientaProyecto>,
    @InjectRepository(LiquidacionNomina)
    private readonly liquidaciones: Repository<LiquidacionNomina>,
  ) {}

  async obtener(usuario: UsuarioAutenticado): Promise<Dashboard> {
    const hoy = hoyColombia();
    const desde = primerDiaMes(hoy);
    const hasta = ultimaFechaMes(hoy);
    const veNomina = usuario.rol === Rol.ADMIN || usuario.rol === Rol.NOMINA;

    const [
      proyectosActivos,
      trabajadoresActivos,
      horasMes,
      alertas,
      materialesPendientes,
      herramientasVencidas,
      avances,
      ultimaLiquidacion,
    ] = await Promise.all([
      this.proyectos.countBy({ estado: EstadoProyecto.ACTIVO }),
      this.trabajadores.countBy({ estado: EstadoTrabajador.ACTIVO }),
      this.horasCosteadas.consultar({ desde, hasta }),
      this.horasCosteadas.alertas(desde, hasta),
      this.materiales.countBy({ estado: In(ESTADOS_MATERIAL_PENDIENTE) }),
      this.herramientas.countBy({
        estado: EstadoHerramienta.ASIGNADA,
        fechaDevolucionPrevista: LessThan(hoy),
      }),
      this.reportes.avanceProyectos(EstadoProyecto.ACTIVO),
      veNomina ? this.ultimaLiquidacion() : Promise.resolve(null),
    ]);

    const costos = await this.reportes.costosPorProyecto(horasMes.filas);
    return {
      fecha: hoy,
      proyectosActivos,
      trabajadoresActivos,
      mes: {
        desde,
        hasta,
        ...resumirCostos(horasMes.filas),
        porTipo: desglosePorTipo(horasMes.filas, horasMes.tipos),
      },
      costoPorProyecto: costos
        .slice(0, PROYECTOS_EN_GRAFICO)
        .map(({ proyectoId, codigo, nombre, horas, costo }) => ({
          proyectoId,
          codigo,
          nombre,
          horas,
          costo,
        })),
      alertasHorasExtra: alertas.length,
      materialesPendientes,
      herramientasVencidas,
      avanceProyectos: avances.map(({ proyecto, avance }) => ({
        id: proyecto.id,
        codigo: proyecto.codigo,
        nombre: proyecto.nombre,
        avanceReal: avance.avanceReal,
        avancePlaneado: avance.avancePlaneado,
        estado: avance.estado,
      })),
      ultimaLiquidacion,
    };
  }

  private async ultimaLiquidacion(): Promise<LiquidacionResumen | null> {
    const [ultima] = await this.liquidaciones.find({
      order: { fechaInicio: 'DESC' },
      take: 1,
    });
    return ultima ? aLiquidacionResumen(ultima) : null;
  }
}
