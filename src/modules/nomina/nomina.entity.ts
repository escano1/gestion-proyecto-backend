import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Trabajador, TipoSalario } from '../trabajadores/trabajador.entity.js';
import { transformadorNumerico } from '../../common/utils/transformadores.js';

export enum TipoPeriodo {
  QUINCENAL = 'QUINCENAL',
  MENSUAL = 'MENSUAL',
}

export enum EstadoLiquidacion {
  BORRADOR = 'BORRADOR',
  CERRADA = 'CERRADA',
}

export enum TipoConcepto {
  DEVENGADO = 'DEVENGADO',
  DEDUCCION = 'DEDUCCION',
}

const dinero = {
  type: 'numeric',
  precision: 16,
  scale: 2,
  transformer: transformadorNumerico,
} as const;

/** Liquidación de un periodo de nómina (consolidado de todos los trabajadores). */
@Entity('liquidaciones_nomina')
@Unique(['fechaInicio', 'fechaFin'])
export class LiquidacionNomina {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  tipoPeriodo: TipoPeriodo;

  @Column({ type: 'smallint' })
  anio: number;

  @Column({ type: 'smallint' })
  mes: number;

  @Column({ type: 'smallint', nullable: true })
  quincena: number | null;

  @Column({ type: 'date' })
  fechaInicio: string;

  @Column({ type: 'date' })
  fechaFin: string;

  @Column({ type: 'varchar', length: 10, default: EstadoLiquidacion.BORRADOR })
  estado: EstadoLiquidacion;

  /** Se activa cuando cambian horas, salarios o parámetros después del cálculo. */
  @Column({ type: 'boolean', default: false })
  requiereRecalculo: boolean;

  @Column({ ...dinero, default: 0 })
  totalDevengado: number;

  @Column({ ...dinero, default: 0 })
  totalDeducciones: number;

  @Column({ ...dinero, default: 0 })
  totalNeto: number;

  @Column({ type: 'int', default: 0 })
  numeroTrabajadores: number;

  @Column({ type: 'timestamptz', nullable: true })
  calculadaEn: Date | null;

  @Column({ type: 'int' })
  creadoPorId: number;

  @Column({ type: 'int', nullable: true })
  cerradaPorId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  cerradaEn: Date | null;

  @OneToMany(() => NominaTrabajador, (nomina) => nomina.liquidacion)
  nominas: Relation<NominaTrabajador[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}

/** Desprendible de pago de un trabajador dentro de una liquidación. */
@Entity('nominas_trabajador')
@Unique(['liquidacionId', 'trabajadorId'])
@Index(['trabajadorId'])
export class NominaTrabajador {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  liquidacionId: number;

  @ManyToOne(() => LiquidacionNomina, (l) => l.nominas, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'liquidacion_id' })
  liquidacion: Relation<LiquidacionNomina>;

  @Column({ type: 'int' })
  trabajadorId: number;

  @ManyToOne(() => Trabajador, { nullable: false })
  @JoinColumn({ name: 'trabajador_id' })
  trabajador: Relation<Trabajador>;

  // Copia de los datos del trabajador al momento del cálculo (trazabilidad).
  @Column({ type: 'varchar', length: 150 })
  nombreTrabajador: string;

  @Column({ type: 'varchar', length: 5 })
  tipoDocumento: string;

  @Column({ type: 'varchar', length: 30 })
  numeroDocumento: string;

  @Column({ type: 'varchar', length: 100 })
  cargo: string;

  @Column({ type: 'varchar', length: 10 })
  tipoSalario: TipoSalario;

  @Column(dinero)
  salarioBase: number;

  @Column(dinero)
  valorHora: number;

  @Column({ type: 'smallint' })
  diasLaborados: number;

  @Column(dinero)
  ibc: number;

  @Column(dinero)
  totalDevengado: number;

  @Column(dinero)
  totalDeducciones: number;

  @Column(dinero)
  netoPagar: number;

  /** Parámetros legales aplicados en el cálculo. */
  @Column({ type: 'jsonb' })
  parametros: Record<string, number>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  alertas: string[];

  @OneToMany(() => ConceptoNomina, (c) => c.nominaTrabajador, { cascade: true })
  conceptos: Relation<ConceptoNomina[]>;
}

@Entity('conceptos_nomina')
@Index(['nominaTrabajadorId'])
export class ConceptoNomina {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  nominaTrabajadorId: number;

  @ManyToOne(() => NominaTrabajador, (n) => n.conceptos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'nomina_trabajador_id' })
  nominaTrabajador: Relation<NominaTrabajador>;

  @Column({ type: 'varchar', length: 10 })
  tipo: TipoConcepto;

  @Column({ type: 'varchar', length: 30 })
  codigo: string;

  @Column({ type: 'varchar', length: 150 })
  descripcion: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: transformadorNumerico,
  })
  cantidad: number | null;

  @Column({ ...dinero, nullable: true })
  valorUnitario: number | null;

  @Column(dinero)
  valor: number;

  @Column({ type: 'smallint' })
  orden: number;
}
