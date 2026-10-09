import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Rol } from '../../common/enums/rol.enum.js';
import type { Fecha } from '../../common/utils/fechas.js';
import type { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/registro-auditoria.entity.js';
import { CodigoParametro } from '../parametros/parametro-legal.entity.js';
import type { ParametrosService } from '../parametros/parametros.service.js';
import { ResolutorParametros } from '../parametros/resolutor-parametros.js';
import { CodigoTipoHora, TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import {
  TipoContrato,
  TipoDocumento,
  TipoJornada,
  TipoSalario,
  Trabajador,
} from '../trabajadores/trabajador.entity.js';
import {
  ConceptoNomina,
  EstadoLiquidacion,
  LiquidacionNomina,
  NominaTrabajador,
  TipoPeriodo,
} from './nomina.entity.js';
import { NominaService } from './nomina.service.js';

const VIGENCIAS: [CodigoParametro, number, Fecha][] = [
  [CodigoParametro.SMMLV, 1_750_905, '2026-01-01'],
  [CodigoParametro.AUXILIO_TRANSPORTE, 249_095, '2026-01-01'],
  [CodigoParametro.UVT, 52_374, '2026-01-01'],
  [CodigoParametro.JORNADA_MAXIMA_SEMANAL, 42, '2026-07-15'],
  [CodigoParametro.RECARGO_NOCTURNO, 0.35, '2024-01-01'],
  [CodigoParametro.RECARGO_EXTRA_DIURNA, 0.25, '2024-01-01'],
  [CodigoParametro.RECARGO_EXTRA_NOCTURNA, 0.75, '2024-01-01'],
  [CodigoParametro.RECARGO_DOMINICAL_FESTIVO, 0.9, '2026-07-01'],
  [CodigoParametro.APORTE_SALUD_EMPLEADO, 0.04, '2024-01-01'],
  [CodigoParametro.APORTE_PENSION_EMPLEADO, 0.04, '2024-01-01'],
  [CodigoParametro.LIMITE_HORAS_EXTRA_DIA, 2, '2024-01-01'],
  [CodigoParametro.LIMITE_HORAS_EXTRA_SEMANA, 12, '2024-01-01'],
];

const usuario = { id: 3, email: 'nomina@empresa.com', nombre: 'Nómina', rol: Rol.NOMINA };

function tipoHora(id: number, codigo: CodigoTipoHora, nombre: string, extra: boolean, nocturna: boolean, dominical: boolean) {
  return Object.assign(new TipoHora(), {
    id,
    codigo,
    nombre,
    descripcion: null,
    esExtra: extra,
    esNocturna: nocturna,
    esDominicalFestiva: dominical,
    orden: id,
    activo: true,
  });
}

function trabajador(id: number, cambios: Partial<Trabajador>): Trabajador {
  return Object.assign(new Trabajador(), {
    id,
    nombre: `Trabajador ${id}`,
    tipoDocumento: TipoDocumento.CC,
    numeroDocumento: String(1000 + id),
    cargo: 'Técnico',
    tipoSalario: TipoSalario.MENSUAL,
    salarioBase: 2_100_000,
    tipoContrato: TipoContrato.INDEFINIDO,
    tipoJornada: TipoJornada.COMPLETA,
    horasSemanales: null,
    aplicaAuxilioTransporte: true,
    fechaIngreso: '2025-01-01',
    fechaRetiro: null,
    ...cambios,
  });
}

function liquidacionGuardada(cambios: Partial<LiquidacionNomina> = {}): LiquidacionNomina {
  return Object.assign(new LiquidacionNomina(), {
    id: 5,
    tipoPeriodo: TipoPeriodo.QUINCENAL,
    anio: 2026,
    mes: 10,
    quincena: 2,
    fechaInicio: '2026-10-16',
    fechaFin: '2026-10-31',
    estado: EstadoLiquidacion.BORRADOR,
    requiereRecalculo: false,
    totalDevengado: 0,
    totalDeducciones: 0,
    totalNeto: 0,
    numeroTrabajadores: 0,
    calculadaEn: null,
    creadoPorId: 1,
    cerradaPorId: null,
    cerradaEn: null,
    creadoEn: new Date('2026-10-01T12:00:00Z'),
    ...cambios,
  });
}

/** EntityManager en memoria con lo mínimo que usa NominaService. */
class ManagerFalso {
  liquidacion: LiquidacionNomina | null = null;
  solapada: LiquidacionNomina | null = null;
  trabajadores: Trabajador[] = [];
  tipos: TipoHora[] = [];
  filasHoras: { trabajadorId: number; fecha: string; tipoHoraId: number; horas: string }[] = [];
  nominas: NominaTrabajador[] = [];
  conceptos: ConceptoNomina[] = [];
  eliminadas: unknown[] = [];
  consultas: string[] = [];

  query = vi.fn(async (sql: string) => {
    this.consultas.push(sql);
    return sql.includes('pg_advisory_xact_lock') ? [] : this.filasHoras;
  });

  getRepository(entidad: unknown) {
    const builder = {
      where: () => builder,
      andWhere: () => builder,
      orderBy: () => builder,
      addOrderBy: () => builder,
      getOne: async () => this.solapada,
      getMany: async () => (entidad === Trabajador ? this.trabajadores : []),
    };
    return { createQueryBuilder: () => builder };
  }

  create(_entidad: unknown, datos: Partial<LiquidacionNomina>) {
    return Object.assign(new LiquidacionNomina(), datos);
  }

  async save(entidad: LiquidacionNomina) {
    entidad.id ??= 5;
    entidad.creadoEn ??= new Date('2026-10-01T12:00:00Z');
    this.liquidacion = entidad;
    return entidad;
  }

  async findOne() {
    return this.liquidacion;
  }

  async find(entidad: unknown) {
    if (entidad === TipoHora) return this.tipos;
    return [...this.nominas].sort((a, b) => a.nombreTrabajador.localeCompare(b.nombreTrabajador));
  }

  async delete(entidad: unknown, criterio: unknown) {
    this.eliminadas.push(criterio);
    if (entidad === NominaTrabajador) this.nominas = [];
  }

  async insert(entidad: unknown, filas: Record<string, unknown>[]) {
    if (entidad === NominaTrabajador) {
      const identifiers = filas.map((fila) => {
        const nomina = Object.assign(new NominaTrabajador(), fila, { id: this.nominas.length + 100 });
        this.nominas.push(nomina);
        return { id: nomina.id };
      });
      return { identifiers };
    }
    this.conceptos.push(...filas.map((f) => Object.assign(new ConceptoNomina(), f)));
    return { identifiers: [] };
  }
}

describe('NominaService', () => {
  let m: ManagerFalso;
  let registrar: ReturnType<typeof vi.fn>;
  let servicio: NominaService;

  beforeEach(() => {
    m = new ManagerFalso();
    m.tipos = [
      tipoHora(2, CodigoTipoHora.NOC, 'Hora ordinaria nocturna', false, true, false),
      tipoHora(3, CodigoTipoHora.HED, 'Hora extra diurna', true, false, false),
      tipoHora(5, CodigoTipoHora.DOM, 'Hora dominical/festiva diurna', false, false, true),
    ];
    registrar = vi.fn(async () => undefined);
    const dataSource = {
      manager: m,
      transaction: async <T>(trabajo: (manager: ManagerFalso) => Promise<T>) => trabajo(m),
    };
    const parametros = {
      crearResolutor: async () =>
        new ResolutorParametros(VIGENCIAS.map(([codigo, valor, vigenteDesde]) => ({ codigo, valor, vigenteDesde }))),
    };
    servicio = new NominaService(
      dataSource as unknown as DataSource,
      {} as Repository<LiquidacionNomina>,
      {} as Repository<NominaTrabajador>,
      parametros as unknown as ParametrosService,
      { registrar } as unknown as AuditoriaService,
      { get: () => undefined } as unknown as ConfigService,
    );
  });

  describe('crear', () => {
    it('valida el periodo antes de abrir la transacción', async () => {
      await expect(
        servicio.crear({ tipoPeriodo: TipoPeriodo.QUINCENAL, anio: 2026, mes: 10 }, usuario),
      ).rejects.toThrow(BadRequestException);
      expect(m.query).not.toHaveBeenCalled();
    });

    it('409 si se solapa con otra liquidación', async () => {
      m.solapada = liquidacionGuardada({ id: 9, tipoPeriodo: TipoPeriodo.MENSUAL, quincena: null, fechaInicio: '2026-10-01' });
      await expect(
        servicio.crear({ tipoPeriodo: TipoPeriodo.QUINCENAL, anio: 2026, mes: 10, quincena: 2 }, usuario),
      ).rejects.toThrow(ConflictException);
      expect(m.consultas[0]).toContain('pg_advisory_xact_lock');
    });

    it('calcula, persiste nóminas y conceptos (caso A) y audita CALCULAR', async () => {
      m.trabajadores = [
        trabajador(1, { nombre: 'Ana' }),
        trabajador(2, { nombre: 'Retirado', fechaRetiro: '2026-10-10' }),
        trabajador(3, { nombre: 'Por hora sin horas', tipoSalario: TipoSalario.POR_HORA, salarioBase: 12_000 }),
      ];
      m.filasHoras = [
        { trabajadorId: 1, fecha: '2026-10-19', tipoHoraId: 2, horas: '3.00' },
        { trabajadorId: 1, fecha: '2026-10-18', tipoHoraId: 5, horas: '2.00' },
        { trabajadorId: 1, fecha: '2026-10-20', tipoHoraId: 3, horas: '4.00' },
      ];

      const respuesta = await servicio.crear(
        { tipoPeriodo: TipoPeriodo.QUINCENAL, anio: 2026, mes: 10, quincena: 2 },
        usuario,
      );

      expect(respuesta).toMatchObject({
        id: 5,
        tipoPeriodo: TipoPeriodo.QUINCENAL,
        quincena: 2,
        fechaInicio: '2026-10-16',
        fechaFin: '2026-10-31',
        estado: EstadoLiquidacion.BORRADOR,
        requiereRecalculo: false,
        totalDevengado: 1_253_048,
        totalDeducciones: 90_280,
        totalNeto: 1_162_768,
        numeroTrabajadores: 1,
        cerradaEn: null,
      });
      expect(typeof respuesta.calculadaEn).toBe('string');
      expect(respuesta.nominas).toEqual([
        {
          id: 100,
          trabajadorId: 1,
          nombreTrabajador: 'Ana',
          numeroDocumento: '1001',
          cargo: 'Técnico',
          tipoSalario: TipoSalario.MENSUAL,
          diasLaborados: 15,
          ibc: 1_128_500,
          totalDevengado: 1_253_048,
          totalDeducciones: 90_280,
          netoPagar: 1_162_768,
          alertas: [],
        },
      ]);
      expect(m.nominas[0]).toMatchObject({ liquidacionId: 5, valorHora: 10_000, salarioBase: 2_100_000 });
      expect(m.nominas[0].parametros).toMatchObject({ smmlv: 1_750_905, recargoDominicalFestivo: 0.9 });
      expect(m.conceptos.map((c) => [c.nominaTrabajadorId, c.orden, c.codigo, c.valor])).toEqual([
        [100, 1, 'SALARIO', 1_050_000],
        [100, 2, 'RECARGO_NOC', 10_500],
        [100, 3, 'HORAS_HED', 50_000],
        [100, 4, 'RECARGO_DOM', 18_000],
        [100, 5, 'AUX_TRANSPORTE', 124_548],
        [100, 6, 'SALUD', 45_140],
        [100, 7, 'PENSION', 45_140],
      ]);
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          entidad: 'LiquidacionNomina',
          entidadId: 5,
          accion: AccionAuditoria.CALCULAR,
          antes: null,
          usuario,
        }),
        m,
      );
    });
  });

  describe('transiciones de estado', () => {
    it('404 si la liquidación no existe', async () => {
      await expect(servicio.cerrar(99, usuario)).rejects.toThrow(NotFoundException);
    });

    it('recalcular solo en BORRADOR y deja requiereRecalculo en false', async () => {
      m.liquidacion = liquidacionGuardada({ estado: EstadoLiquidacion.CERRADA });
      await expect(servicio.recalcular(5, usuario)).rejects.toThrow(ConflictException);

      m.liquidacion = liquidacionGuardada({ requiereRecalculo: true });
      m.trabajadores = [trabajador(1, { nombre: 'Ana' })];
      const respuesta = await servicio.recalcular(5, usuario);
      expect(respuesta.requiereRecalculo).toBe(false);
      expect(respuesta.totalDevengado).toBe(1_174_548);
      expect(m.eliminadas).toContainEqual({ liquidacionId: 5 });
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: AccionAuditoria.CALCULAR, antes: expect.objectContaining({ id: 5 }) }),
        m,
      );
    });

    it('cerrar: 409 si ya está cerrada o requiere recálculo', async () => {
      m.liquidacion = liquidacionGuardada({ estado: EstadoLiquidacion.CERRADA });
      await expect(servicio.cerrar(5, usuario)).rejects.toThrow('ya está cerrada');
      m.liquidacion = liquidacionGuardada({ requiereRecalculo: true });
      await expect(servicio.cerrar(5, usuario)).rejects.toThrow('recalcule');
    });

    it('cerrar y reabrir registran usuario, fecha y auditoría', async () => {
      m.liquidacion = liquidacionGuardada();
      const cerrada = await servicio.cerrar(5, usuario);
      expect(cerrada.estado).toBe(EstadoLiquidacion.CERRADA);
      expect(typeof cerrada.cerradaEn).toBe('string');
      expect(m.liquidacion?.cerradaPorId).toBe(usuario.id);
      expect(registrar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: AccionAuditoria.CERRAR }), m);

      const reabierta = await servicio.reabrir(5, usuario);
      expect(reabierta.estado).toBe(EstadoLiquidacion.BORRADOR);
      expect(reabierta.cerradaEn).toBeNull();
      expect(m.liquidacion?.cerradaPorId).toBeNull();
      expect(registrar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: AccionAuditoria.REABRIR }), m);
    });

    it('reabrir: 409 si no está cerrada', async () => {
      m.liquidacion = liquidacionGuardada();
      await expect(servicio.reabrir(5, usuario)).rejects.toThrow(ConflictException);
    });

    it('eliminar: solo BORRADOR', async () => {
      m.liquidacion = liquidacionGuardada({ estado: EstadoLiquidacion.CERRADA });
      await expect(servicio.eliminar(5, usuario)).rejects.toThrow(ConflictException);

      m.liquidacion = liquidacionGuardada();
      await servicio.eliminar(5, usuario);
      expect(m.eliminadas).toContainEqual({ id: 5 });
      expect(registrar).toHaveBeenLastCalledWith(
        expect.objectContaining({ accion: AccionAuditoria.ELIMINAR, despues: null }),
        m,
      );
    });
  });
});
