import { EstadoMaterial } from './material-proyecto.entity.js';
import { completarFechaEntrega } from './reglas-materiales.js';

const HOY = '2026-10-08';

describe('completarFechaEntrega', () => {
  it.each([EstadoMaterial.ENTREGADO, EstadoMaterial.INSTALADO])('%s sin fecha → hoy', (estado) => {
    expect(completarFechaEntrega(estado, null, HOY)).toBe(HOY);
  });

  it('respeta la fecha de entrega indicada', () => {
    expect(completarFechaEntrega(EstadoMaterial.ENTREGADO, '2026-10-01', HOY)).toBe('2026-10-01');
  });

  it.each([EstadoMaterial.PENDIENTE, EstadoMaterial.SOLICITADO])(
    '%s no asigna fecha de entrega',
    (estado) => {
      expect(completarFechaEntrega(estado, null, HOY)).toBeNull();
    },
  );
});
