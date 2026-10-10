import { costoMaterial } from './reglas-materiales.js';

describe('costoMaterial', () => {
  it('multiplica precio por cantidad y redondea al peso', () => {
    expect(costoMaterial({ precioUnitario: 12_500, cantidadSolicitada: 300 })).toBe(3_750_000);
    expect(costoMaterial({ precioUnitario: 1_999.99, cantidadSolicitada: 2.5 })).toBe(5_000);
  });

  it('un precio de 0 no genera costo', () => {
    expect(costoMaterial({ precioUnitario: 0, cantidadSolicitada: 10 })).toBe(0);
  });
});
