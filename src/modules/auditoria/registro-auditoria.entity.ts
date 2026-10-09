import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AccionAuditoria {
  CREAR = 'CREAR',
  ACTUALIZAR = 'ACTUALIZAR',
  ELIMINAR = 'ELIMINAR',
  CALCULAR = 'CALCULAR',
  CERRAR = 'CERRAR',
  REABRIR = 'REABRIR',
}

/** Bitácora inmutable de cambios: quién, cuándo y qué cambió. Sin FK para que sobreviva a borrados. */
@Entity('auditoria')
@Index(['entidad', 'entidadId'])
@Index(['fecha'])
export class RegistroAuditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60 })
  entidad: string;

  @Column({ type: 'varchar', length: 40 })
  entidadId: string;

  @Column({ type: 'varchar', length: 20 })
  accion: AccionAuditoria;

  @Column({ type: 'jsonb', nullable: true })
  datosAnteriores: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  datosNuevos: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  usuarioEmail: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha: Date;
}
