import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';

@Entity('asignaciones_proyecto')
@Index(['trabajadorId', 'proyectoId'])
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

  @Column({ type: 'date' })
  fechaInicio: string;

  @Column({ type: 'date', nullable: true })
  fechaFin: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rolEnProyecto: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
