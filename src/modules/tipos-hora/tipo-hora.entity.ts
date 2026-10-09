import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum CodigoTipoHora {
  ORD = 'ORD',
  NOC = 'NOC',
  HED = 'HED',
  HEN = 'HEN',
  DOM = 'DOM',
  DOMN = 'DOMN',
  HEDD = 'HEDD',
  HEDN = 'HEDN',
}

/**
 * Clasificación de horas. El recargo no se guarda aquí: se deriva de los
 * parámetros legales vigentes en la fecha trabajada (ver recargos.ts).
 */
@Entity('tipos_hora')
export class TipoHora {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10, unique: true })
  codigo: CodigoTipoHora;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ type: 'boolean' })
  esExtra: boolean;

  @Column({ type: 'boolean' })
  esNocturna: boolean;

  @Column({ type: 'boolean' })
  esDominicalFestiva: boolean;

  @Column({ type: 'smallint' })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
