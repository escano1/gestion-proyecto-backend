import { EsquemaInicial1791520580457 } from './migrations/1791520580457-EsquemaInicial.js';
import { DatosIniciales1791520580458 } from './migrations/1791520580458-DatosIniciales.js';
import { ProyectoClienteUbicacionOpcionales1791562941155 } from './migrations/1791562941155-ProyectoClienteUbicacionOpcionales.js';
import { MaterialPrecioUnitario1791565334979 } from './migrations/1791565334979-MaterialPrecioUnitario.js';
import { NominaTipoPeriodoPersonalizado1791576748015 } from './migrations/1791576748015-NominaTipoPeriodoPersonalizado.js';
import { HorasYNominaSemanal1791600000000 } from './migrations/1791600000000-HorasYNominaSemanal.js';
import { QuitarHerramientasHitosBitacora1791610000000 } from './migrations/1791610000000-QuitarHerramientasHitosBitacora.js';
import { MaterialesSimples1791620000000 } from './migrations/1791620000000-MaterialesSimples.js';

/** Lista explícita de migraciones en orden de ejecución. Agregar aquí cada migración nueva. */
export const MIGRACIONES = [
  EsquemaInicial1791520580457,
  DatosIniciales1791520580458,
  ProyectoClienteUbicacionOpcionales1791562941155,
  MaterialPrecioUnitario1791565334979,
  NominaTipoPeriodoPersonalizado1791576748015,
  HorasYNominaSemanal1791600000000,
  QuitarHerramientasHitosBitacora1791610000000,
  MaterialesSimples1791620000000,
];
