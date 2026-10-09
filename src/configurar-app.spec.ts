import { origenesPermitidos } from './configurar-app.js';

const permite = (valor: string | undefined, origen: string) =>
  origenesPermitidos(valor).some((regla) =>
    typeof regla === 'string' ? regla === origen : regla.test(origen),
  );

describe('origenesPermitidos', () => {
  const vercel = 'https://gestion-proyecto-frontend.vercel.app';

  it('usa localhost:3000 cuando la variable no está definida', () => {
    expect(permite(undefined, 'http://localhost:3000')).toBe(true);
    expect(permite(undefined, vercel)).toBe(false);
  });

  it('tolera comillas, espacios y barra final como las guardan los paneles', () => {
    for (const valor of [
      `"${vercel}"`,
      `'${vercel}/'`,
      ` ${vercel}// `,
      `"${vercel}, http://localhost:3000"`,
    ]) {
      expect(permite(valor, vercel)).toBe(true);
    }
  });

  it('admite varios orígenes y comodines de subdominio acotados', () => {
    const valor = `${vercel},https://gestion-proyecto-frontend-*.vercel.app`;
    expect(
      permite(
        valor,
        'https://gestion-proyecto-frontend-git-main-escano1s-projects.vercel.app',
      ),
    ).toBe(true);
    expect(permite(valor, 'https://otra-app.vercel.app')).toBe(false);
    expect(permite(valor, 'http://gestion-proyecto-frontend.vercel.app')).toBe(
      false,
    );
  });

  it('no permite nada con la variable vacía ni con rutas', () => {
    expect(origenesPermitidos('')).toEqual([]);
    expect(permite(`${vercel}/login`, vercel)).toBe(false);
  });
});
