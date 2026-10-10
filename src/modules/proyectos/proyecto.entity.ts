import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { transformadorNumerico } from '../../common/utils/transformadores.js';

export enum EstadoProyecto {
  ACTIVO = 'ACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  FINALIZADO = 'FINALIZADO',
}

@Entity('proyectos')
export class Proyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  cliente: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ubicacion: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'date' })
  fechaInicio: string;

  @Column({ type: 'date', nullable: true })
  fechaFinPlaneada: string | null;

  @Column({ type: 'date', nullable: true })
  fechaFinReal: string | null;

  @Column({ type: 'varchar', length: 12, default: EstadoProyecto.ACTIVO })
  estado: EstadoProyecto;

  @Column({
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
    transformer: transformadorNumerico,
  })
  presupuesto: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
