import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { transformadorNumerico } from '../../common/utils/transformadores.js';

export enum TipoDocumento {
  CC = 'CC',
  CE = 'CE',
  PA = 'PA',
  PPT = 'PPT',
  TI = 'TI',
}

export enum TipoSalario {
  MENSUAL = 'MENSUAL',
  POR_HORA = 'POR_HORA',
}

export enum TipoContrato {
  INDEFINIDO = 'INDEFINIDO',
  FIJO = 'FIJO',
  OBRA_LABOR = 'OBRA_LABOR',
  APRENDIZAJE = 'APRENDIZAJE',
}

/** COMPLETA usa la jornada máxima legal vigente; PARCIAL usa `horasSemanales`. */
export enum TipoJornada {
  COMPLETA = 'COMPLETA',
  PARCIAL = 'PARCIAL',
}

export enum EstadoTrabajador {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
}

@Entity('trabajadores')
export class Trabajador {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 5 })
  tipoDocumento: TipoDocumento;

  @Column({ type: 'varchar', length: 30, unique: true })
  numeroDocumento: string;

  @Column({ type: 'varchar', length: 100 })
  cargo: string;

  @Column({ type: 'varchar', length: 10 })
  tipoSalario: TipoSalario;

  /** Salario mensual (MENSUAL) o valor de la hora (POR_HORA). */
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: transformadorNumerico })
  salarioBase: number;

  @Column({ type: 'varchar', length: 15 })
  tipoContrato: TipoContrato;

  @Column({ type: 'varchar', length: 10, default: TipoJornada.COMPLETA })
  tipoJornada: TipoJornada;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: transformadorNumerico,
  })
  horasSemanales: number | null;

  @Column({ type: 'boolean', default: true })
  aplicaAuxilioTransporte: boolean;

  @Column({ type: 'varchar', length: 10, default: EstadoTrabajador.ACTIVO })
  estado: EstadoTrabajador;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  eps: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fondoPension: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
