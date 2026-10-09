import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { transformadorNumerico } from '../../common/utils/transformadores.js';

export enum CodigoParametro {
  SMMLV = 'SMMLV',
  AUXILIO_TRANSPORTE = 'AUXILIO_TRANSPORTE',
  UVT = 'UVT',
  JORNADA_MAXIMA_SEMANAL = 'JORNADA_MAXIMA_SEMANAL',
  RECARGO_NOCTURNO = 'RECARGO_NOCTURNO',
  RECARGO_EXTRA_DIURNA = 'RECARGO_EXTRA_DIURNA',
  RECARGO_EXTRA_NOCTURNA = 'RECARGO_EXTRA_NOCTURNA',
  RECARGO_DOMINICAL_FESTIVO = 'RECARGO_DOMINICAL_FESTIVO',
  APORTE_SALUD_EMPLEADO = 'APORTE_SALUD_EMPLEADO',
  APORTE_PENSION_EMPLEADO = 'APORTE_PENSION_EMPLEADO',
  LIMITE_HORAS_EXTRA_DIA = 'LIMITE_HORAS_EXTRA_DIA',
  LIMITE_HORAS_EXTRA_SEMANA = 'LIMITE_HORAS_EXTRA_SEMANA',
}

/**
 * Parámetro legal con fecha de vigencia. Un cambio normativo se registra como
 * una nueva fila; el valor aplicable a una fecha es el de mayor `vigenteDesde`
 * que no la supere. Los porcentajes se guardan como fracción (0.35 = 35 %).
 */
@Entity('parametros_legales')
@Unique(['codigo', 'vigenteDesde'])
export class ParametroLegal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40 })
  codigo: CodigoParametro;

  @Column({ type: 'numeric', precision: 18, scale: 6, transformer: transformadorNumerico })
  valor: number;

  @Column({ type: 'date' })
  vigenteDesde: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  norma: string | null;

  @Column({ type: 'int', nullable: true })
  creadoPorId: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
