import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';

export enum EstadoHerramienta {
  ASIGNADA = 'ASIGNADA',
  DEVUELTA = 'DEVUELTA',
  EXTRAVIADA = 'EXTRAVIADA',
}

@Entity('herramientas_proyecto')
@Index(['proyectoId'])
export class HerramientaProyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  proyectoId: number;

  @ManyToOne(() => Proyecto, { nullable: false })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Relation<Proyecto>;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  /** Serial o placa de inventario. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  codigo: string | null;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'int', nullable: true })
  responsableId: number | null;

  @ManyToOne(() => Trabajador, { nullable: true })
  @JoinColumn({ name: 'responsable_id' })
  responsable: Relation<Trabajador> | null;

  @Column({ type: 'date' })
  fechaAsignacion: string;

  @Column({ type: 'date', nullable: true })
  fechaDevolucionPrevista: string | null;

  @Column({ type: 'date', nullable: true })
  fechaDevolucion: string | null;

  @Column({ type: 'varchar', length: 12, default: EstadoHerramienta.ASIGNADA })
  estado: EstadoHerramienta;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
