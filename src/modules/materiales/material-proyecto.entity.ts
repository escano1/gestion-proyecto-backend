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
import { Usuario } from '../usuarios/usuario.entity.js';
import { transformadorNumerico } from '../../common/utils/transformadores.js';

export enum EstadoMaterial {
  PENDIENTE = 'PENDIENTE',
  SOLICITADO = 'SOLICITADO',
  ENTREGADO = 'ENTREGADO',
  INSTALADO = 'INSTALADO',
}

const cantidad = {
  type: 'numeric',
  precision: 12,
  scale: 2,
  transformer: transformadorNumerico,
} as const;

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

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 20 })
  unidadMedida: string;

  @Column(cantidad)
  cantidadSolicitada: number;

  @Column({ ...cantidad, default: 0 })
  cantidadEntregada: number;

  @Column({ type: 'varchar', length: 12, default: EstadoMaterial.PENDIENTE })
  estado: EstadoMaterial;

  @Column({ type: 'date' })
  fechaSolicitud: string;

  @Column({ type: 'date', nullable: true })
  fechaRequerida: string | null;

  @Column({ type: 'date', nullable: true })
  fechaEntrega: string | null;

  @Column({ type: 'int' })
  solicitadoPorId: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'solicitado_por_id' })
  solicitadoPor: Relation<Usuario>;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
