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

/** Material de un proyecto: su costo es `precioUnitario × cantidadSolicitada`. */
@Entity('materiales_proyecto')
@Index(['proyectoId'])
export class MaterialProyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  proyectoId: number;

  @ManyToOne(() => Proyecto, { nullable: false })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Relation<Proyecto>;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 20 })
  unidadMedida: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: transformadorNumerico })
  cantidadSolicitada: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: transformadorNumerico })
  precioUnitario: number;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
