import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Proyecto } from '../proyectos/proyecto.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

@Entity('bitacora_entradas')
@Index(['proyectoId', 'fecha'])
export class BitacoraEntrada {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  proyectoId: number;

  @ManyToOne(() => Proyecto, { nullable: false })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Relation<Proyecto>;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'int' })
  autorId: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'autor_id' })
  autor: Relation<Usuario>;

  @OneToMany(() => BitacoraAdjunto, (a) => a.entrada)
  adjuntos: Relation<BitacoraAdjunto[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}

/**
 * Adjunto (foto o documento) guardado en PostgreSQL: el disco de Railway es
 * efímero y así los respaldos de la base incluyen los archivos.
 */
@Entity('bitacora_adjuntos')
@Index(['entradaId'])
export class BitacoraAdjunto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  entradaId: number;

  @ManyToOne(() => BitacoraEntrada, (e) => e.adjuntos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entrada_id' })
  entrada: Relation<BitacoraEntrada>;

  @Column({ type: 'varchar', length: 255 })
  nombreArchivo: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'int' })
  tamanoBytes: number;

  @Column({ type: 'bytea', select: false })
  contenido: Buffer;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
