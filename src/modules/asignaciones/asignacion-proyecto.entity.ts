import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';

/** Trabajador habilitado para registrar horas en un proyecto. */
@Entity('asignaciones_proyecto')
@Unique('uq_asignacion_trabajador_proyecto', ['trabajadorId', 'proyectoId'])
@Index(['proyectoId'])
export class AsignacionProyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  trabajadorId: number;

  @ManyToOne(() => Trabajador, { nullable: false })
  @JoinColumn({ name: 'trabajador_id' })
  trabajador: Relation<Trabajador>;

  @Column({ type: 'int' })
  proyectoId: number;

  @ManyToOne(() => Proyecto, { nullable: false })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Relation<Proyecto>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rolEnProyecto: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
