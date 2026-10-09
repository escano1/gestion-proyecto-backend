// Carga usuarios de prueba (uno por rol) y datos de ejemplo a través del API, respetando sus validaciones.
// Uso: con el API corriendo, `npm run seed:demo`. Es idempotente y solo acepta un API local.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api`;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(API) && !process.argv.includes('--permitir-remoto')) {
  console.error(`Se niega a sembrar datos de prueba en ${API}. Use un API local o --permitir-remoto.`);
  process.exit(1);
}

export const USUARIOS_DEMO = [
  { nombre: 'Gloria Gestora', email: 'gestor@empresa.com', password: 'Gestor12345', rol: 'GESTOR_PROYECTOS' },
  { nombre: 'Nora Nómina', email: 'nomina@empresa.com', password: 'Nomina12345', rol: 'NOMINA' },
  { nombre: 'Carlos Consulta', email: 'consulta@empresa.com', password: 'Consulta123', rol: 'CONSULTA' },
];

let token = '';

async function llamar(metodo, ruta, cuerpo) {
  const respuesta = await fetch(API + ruta, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  if (!respuesta.ok) throw new Error(`${metodo} ${ruta} → ${respuesta.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

const fechaIso = (fecha) => fecha.toISOString().slice(0, 10);
const hoy = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())}T00:00:00Z`);
const haceDias = (dias) => fechaIso(new Date(hoy.getTime() - dias * 86_400_000));

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Defina ADMIN_EMAIL y ADMIN_PASSWORD en .env (el administrador inicial).');
  process.exit(1);
}
token = (await llamar('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).accessToken;

const existentes = new Set((await llamar('GET', '/usuarios')).map((u) => u.email));
for (const usuario of USUARIOS_DEMO) {
  if (!existentes.has(usuario.email)) await llamar('POST', '/usuarios', usuario);
}
console.log('Usuarios de prueba listos.');

if ((await llamar('GET', '/proyectos')).some((p) => p.codigo === 'PRY-001')) {
  console.log('Ya existen datos de ejemplo (PRY-001): no se cargan de nuevo.');
  process.exit(0);
}

const inicio = haceDias(60);
const p1 = await llamar('POST', '/proyectos', {
  codigo: 'PRY-001', nombre: 'Subestación 34,5 kV Malambo', cliente: 'Air-e', ubicacion: 'Malambo, Atlántico',
  fechaInicio: inicio, fechaFinPlaneada: haceDias(-150), presupuesto: 85_000_000,
  descripcion: 'Montaje electromecánico de subestación',
});
const p2 = await llamar('POST', '/proyectos', {
  codigo: 'PRY-002', nombre: 'Red de media tensión Soledad', cliente: 'Alcaldía de Soledad',
  ubicacion: 'Soledad, Atlántico', fechaInicio: inicio, fechaFinPlaneada: haceDias(-60), presupuesto: 32_000_000,
});
await llamar('POST', '/proyectos', {
  codigo: 'PRY-003', nombre: 'Alumbrado público Puerto Colombia', cliente: 'Municipio de Puerto Colombia',
  ubicacion: 'Puerto Colombia, Atlántico', fechaInicio: haceDias(120), estado: 'SUSPENDIDO',
});

const base = { tipoDocumento: 'CC', tipoContrato: 'INDEFINIDO', fechaIngreso: haceDias(365), eps: 'Sura', fondoPension: 'Porvenir' };
const ana = await llamar('POST', '/trabajadores', { ...base, nombre: 'Ana Torres', numeroDocumento: '1045789123', cargo: 'Técnica electricista', tipoSalario: 'MENSUAL', salarioBase: 2_100_000 });
const luis = await llamar('POST', '/trabajadores', { ...base, nombre: 'Luis Gómez', numeroDocumento: '72198456', cargo: 'Liniero', tipoSalario: 'POR_HORA', salarioBase: 12_000, tipoContrato: 'OBRA_LABOR' });
const maria = await llamar('POST', '/trabajadores', { ...base, nombre: 'María Rodríguez', numeroDocumento: '32789654', cargo: 'Ingeniera residente', tipoSalario: 'MENSUAL', salarioBase: 7_500_000 });
const pedro = await llamar('POST', '/trabajadores', { ...base, nombre: 'Pedro Castillo', numeroDocumento: '1140876543', cargo: 'Auxiliar', tipoSalario: 'MENSUAL', salarioBase: 1_750_905 });

for (const t of [ana, luis, maria, pedro]) {
  await llamar('POST', '/asignaciones', { trabajadorId: t.id, proyectoId: p1.id, fechaInicio: inicio, rolEnProyecto: t.cargo });
}
for (const t of [ana, maria]) await llamar('POST', '/asignaciones', { trabajadorId: t.id, proyectoId: p2.id, fechaInicio: inicio });

const tipos = Object.fromEntries((await llamar('GET', '/tipos-hora')).map((t) => [t.codigo, t.id]));
const horas = (codigo, cantidad) => ({ tipoHoraId: tipos[codigo], horas: cantidad });
const registros = [];
for (let d = 45; d >= 1; d--) {
  const fecha = haceDias(d);
  const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay(); // 0 = domingo
  if (diaSemana === 0) {
    registros.push({ trabajadorId: ana.id, proyectoId: p1.id, fecha, detalles: [horas('DOM', 4)] });
    continue;
  }
  const conExtra = d % 9 === 0 ? [horas('HED', 3)] : [];
  registros.push({ trabajadorId: ana.id, proyectoId: p1.id, fecha, detalles: [horas('ORD', 7), ...conExtra] });
  registros.push({ trabajadorId: luis.id, proyectoId: p1.id, fecha, detalles: diaSemana === 3 ? [horas('ORD', 6), horas('NOC', 2)] : [horas('ORD', 8)] });
  registros.push({ trabajadorId: maria.id, proyectoId: diaSemana % 2 ? p1.id : p2.id, fecha, detalles: [horas('ORD', 8)] });
  if (diaSemana !== 6) {
    registros.push({ trabajadorId: pedro.id, proyectoId: p1.id, fecha, detalles: [horas('ORD', 7), ...(diaSemana === 5 ? [horas('HEN', 2)] : [])] });
  }
}
const lote = await llamar('PUT', '/registro-horas/lote', { registros });
console.log(`Horas: ${lote.creados} registros, ${lote.alertas.length} alertas legales.`);

// Última quincena ya terminada (sus horas están completas en el rango cargado).
const [anio, mes, dia] = fechaIso(hoy).split('-').map(Number);
const quincena = dia > 15 ? { anio, mes, quincena: 1 } : mes === 1 ? { anio: anio - 1, mes: 12, quincena: 2 } : { anio, mes: mes - 1, quincena: 2 };
const liquidacion = await llamar('POST', '/nomina/liquidaciones', { tipoPeriodo: 'QUINCENAL', ...quincena });
console.log(`Liquidación en borrador: ${liquidacion.fechaInicio} a ${liquidacion.fechaFin}, neto ${liquidacion.totalNeto}.`);

await llamar('POST', `/proyectos/${p1.id}/materiales`, { nombre: 'Cable XLPE 15 kV 1/0', unidadMedida: 'm', cantidadSolicitada: 450, fechaRequerida: haceDias(5) });
await llamar('POST', `/proyectos/${p1.id}/materiales`, { nombre: 'Transformador de potencia 5 MVA', unidadMedida: 'und', cantidadSolicitada: 1, estado: 'SOLICITADO', fechaRequerida: haceDias(-40) });
await llamar('POST', `/proyectos/${p1.id}/herramientas`, { nombre: 'Megger 5 kV', codigo: 'EQ-014', cantidad: 1, responsableId: maria.id, fechaAsignacion: haceDias(50), fechaDevolucionPrevista: haceDias(3) });
await llamar('POST', `/proyectos/${p1.id}/herramientas`, { nombre: 'Pértiga telescópica', cantidad: 2, responsableId: luis.id, fechaAsignacion: haceDias(50) });
for (const [nombre, diasHasta, peso, porcentajeAvance] of [
  ['Ingeniería de detalle', 30, 15, 100],
  ['Obras civiles', -10, 25, 60],
  ['Montaje electromecánico', -70, 35, 10],
  ['Pruebas y puesta en servicio', -130, 25, 0],
]) {
  await llamar('POST', `/proyectos/${p1.id}/hitos`, { nombre, fechaPlaneada: haceDias(diasHasta), peso, porcentajeAvance });
}
const entrada = new FormData();
entrada.append('fecha', haceDias(2));
entrada.append('descripcion', 'Fundida de bases para pórticos de 34,5 kV. Inspección de interventoría sin observaciones.');
await fetch(`${API}/proyectos/${p1.id}/bitacora`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: entrada }).then(async (r) => {
  if (!r.ok) throw new Error(`Bitácora → ${r.status} ${await r.text()}`);
});

console.log('Datos de ejemplo cargados: 3 proyectos, 4 trabajadores, horas, nómina, materiales, herramientas, hitos y bitácora.');
