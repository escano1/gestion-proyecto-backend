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
import { transformadorNumerico } from '../../common/utils/transformadores.js';

export enum EstadoHito {
  PENDIENTE = 'PENDIENTE',
  EN_PROGRESO = 'EN_PROGRESO',
  COMPLETADO = 'COMPLETADO',
}

const porcentaje = {
  type: 'numeric',
  precision: 5,
  scale: 2,
  transformer: transformadorNumerico,
} as const;

@Entity('hitos_proyecto')
@Index(['proyectoId'])
export class HitoProyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  proyectoId: number;

  @ManyToOne(() => Proyecto, { nullable: false })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Relation<Proyecto>;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ type: 'date' })
  fechaPlaneada: string;

  @Column({ type: 'date', nullable: true })
  fechaReal: string | null;

  /** Peso relativo del hito dentro del proyecto (en porcentaje). */
  @Column(porcentaje)
  peso: number;

  @Column({ ...porcentaje, default: 0 })
  porcentajeAvance: number;

  @Column({ type: 'varchar', length: 12, default: EstadoHito.PENDIENTE })
  estado: EstadoHito;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
