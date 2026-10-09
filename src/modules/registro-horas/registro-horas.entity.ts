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
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import { transformadorNumerico } from '../../common/utils/transformadores.js';

/** Jornada de un trabajador en un proyecto y fecha; las horas van por tipo en el detalle. */
@Entity('registros_horas')
@Unique('uq_registro_trabajador_proyecto_fecha', ['trabajadorId', 'proyectoId', 'fecha'])
@Index(['fecha'])
@Index(['trabajadorId', 'fecha'])
export class RegistroHoras {
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
  fecha: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observacion: string | null;

  @OneToMany(() => RegistroHorasDetalle, (detalle) => detalle.registro, {
    cascade: true,
  })
  detalles: Relation<RegistroHorasDetalle[]>;

  @Column({ type: 'int' })
  creadoPorId: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'creado_por_id' })
  creadoPor: Relation<Usuario>;

  @Column({ type: 'int', nullable: true })
  actualizadoPorId: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'actualizado_por_id' })
  actualizadoPor: Relation<Usuario> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}

@Entity('registros_horas_detalle')
@Unique(['registroId', 'tipoHoraId'])
export class RegistroHorasDetalle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  registroId: number;

  @ManyToOne(() => RegistroHoras, (registro) => registro.detalles, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'registro_id' })
  registro: Relation<RegistroHoras>;

  @Column({ type: 'int' })
  tipoHoraId: number;

  @ManyToOne(() => TipoHora, { nullable: false })
  @JoinColumn({ name: 'tipo_hora_id' })
  tipoHora: Relation<TipoHora>;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: transformadorNumerico })
  horas: number;
}
