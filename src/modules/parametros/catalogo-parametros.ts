import { CodigoParametro } from './parametro-legal.entity.js';

export type UnidadParametro = 'PESOS' | 'FRACCION' | 'HORAS';

export interface DefinicionParametro {
  codigo: CodigoParametro;
  nombre: string;
  unidad: UnidadParametro;
  descripcion: string;
}

export const CATALOGO_PARAMETROS: Record<CodigoParametro, DefinicionParametro> = {
  [CodigoParametro.SMMLV]: {
    codigo: CodigoParametro.SMMLV,
    nombre: 'Salario mínimo mensual legal vigente',
    unidad: 'PESOS',
    descripcion: 'Base para auxilio de transporte, Fondo de Solidaridad Pensional y topes de IBC.',
  },
  [CodigoParametro.AUXILIO_TRANSPORTE]: {
    codigo: CodigoParametro.AUXILIO_TRANSPORTE,
    nombre: 'Auxilio de transporte mensual',
    unidad: 'PESOS',
    descripcion: 'Se paga a quienes devengan hasta 2 SMMLV, proporcional a los días laborados.',
  },
  [CodigoParametro.UVT]: {
    codigo: CodigoParametro.UVT,
    nombre: 'Unidad de Valor Tributario',
    unidad: 'PESOS',
    descripcion: 'Usada en la tabla de retención en la fuente (art. 383 E.T.).',
  },
  [CodigoParametro.JORNADA_MAXIMA_SEMANAL]: {
    codigo: CodigoParametro.JORNADA_MAXIMA_SEMANAL,
    nombre: 'Jornada máxima semanal',
    unidad: 'HORAS',
    descripcion: 'Ley 2101 de 2021. Horas mensuales = jornada semanal × 5 (divisor del valor hora).',
  },
  [CodigoParametro.RECARGO_NOCTURNO]: {
    codigo: CodigoParametro.RECARGO_NOCTURNO,
    nombre: 'Recargo nocturno',
    unidad: 'FRACCION',
    descripcion: 'Recargo sobre la hora ordinaria trabajada en horario nocturno.',
  },
  [CodigoParametro.RECARGO_EXTRA_DIURNA]: {
    codigo: CodigoParametro.RECARGO_EXTRA_DIURNA,
    nombre: 'Recargo hora extra diurna',
    unidad: 'FRACCION',
    descripcion: 'La hora extra se paga a valor hora × (1 + recargo).',
  },
  [CodigoParametro.RECARGO_EXTRA_NOCTURNA]: {
    codigo: CodigoParametro.RECARGO_EXTRA_NOCTURNA,
    nombre: 'Recargo hora extra nocturna',
    unidad: 'FRACCION',
    descripcion: 'No se acumula con el recargo nocturno (art. 170 C.S.T.).',
  },
  [CodigoParametro.RECARGO_DOMINICAL_FESTIVO]: {
    codigo: CodigoParametro.RECARGO_DOMINICAL_FESTIVO,
    nombre: 'Recargo dominical y festivo',
    unidad: 'FRACCION',
    descripcion: 'Ley 2466 de 2025: 80 % (jul-2025), 90 % (jul-2026), 100 % (jul-2027). Se suma a los demás recargos.',
  },
  [CodigoParametro.APORTE_SALUD_EMPLEADO]: {
    codigo: CodigoParametro.APORTE_SALUD_EMPLEADO,
    nombre: 'Aporte a salud (trabajador)',
    unidad: 'FRACCION',
    descripcion: 'Porcentaje del IBC descontado al trabajador.',
  },
  [CodigoParametro.APORTE_PENSION_EMPLEADO]: {
    codigo: CodigoParametro.APORTE_PENSION_EMPLEADO,
    nombre: 'Aporte a pensión (trabajador)',
    unidad: 'FRACCION',
    descripcion: 'Porcentaje del IBC descontado al trabajador.',
  },
  [CodigoParametro.LIMITE_HORAS_EXTRA_DIA]: {
    codigo: CodigoParametro.LIMITE_HORAS_EXTRA_DIA,
    nombre: 'Límite de horas extra por día',
    unidad: 'HORAS',
    descripcion: 'Umbral de alerta de horas extra diarias.',
  },
  [CodigoParametro.LIMITE_HORAS_EXTRA_SEMANA]: {
    codigo: CodigoParametro.LIMITE_HORAS_EXTRA_SEMANA,
    nombre: 'Límite de horas extra por semana',
    unidad: 'HORAS',
    descripcion: 'Umbral de alerta de horas extra semanales.',
  },
};
