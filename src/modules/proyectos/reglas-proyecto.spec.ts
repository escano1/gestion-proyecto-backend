import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { erroresFechasProyecto } from './reglas-proyecto.js';
import { ActualizarProyectoDto } from './proyectos.dto.js';

describe('erroresFechasProyecto', () => {
  const inicio = { fechaInicio: '2026-03-01', fechaFinPlaneada: null, fechaFinReal: null };

  it('acepta fechas de fin nulas, iguales o posteriores al inicio', () => {
    expect(erroresFechasProyecto(inicio)).toEqual([]);
    expect(
      erroresFechasProyecto({ ...inicio, fechaFinPlaneada: '2026-03-01', fechaFinReal: '2026-12-31' }),
    ).toEqual([]);
  });

  it('rechaza fechas de fin anteriores al inicio', () => {
    expect(
      erroresFechasProyecto({ ...inicio, fechaFinPlaneada: '2026-02-28', fechaFinReal: '2026-01-01' }),
    ).toEqual([
      'La fecha de fin planeada no puede ser anterior a la fecha de inicio',
      'La fecha de fin real no puede ser anterior a la fecha de inicio',
    ]);
  });
});

describe('ActualizarProyectoDto', () => {
  const propiedadesConError = async (datos: object) =>
    (await validate(plainToInstance(ActualizarProyectoDto, datos))).map((e) => e.property);

  it('permite limpiar campos anulables pero no los obligatorios', async () => {
    expect(await propiedadesConError({ fechaFinReal: null, presupuesto: null })).toEqual([]);
    expect(await propiedadesConError({ codigo: null, estado: null })).toEqual(['codigo', 'estado']);
  });

  it('valida presupuesto no negativo con máximo 2 decimales', async () => {
    expect(await propiedadesConError({ presupuesto: -1 })).toEqual(['presupuesto']);
    expect(await propiedadesConError({ presupuesto: 10.123 })).toEqual(['presupuesto']);
  });
});
