import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { crearAppPruebas, iniciarSesion, reiniciarBaseDatos } from './app-pruebas.js';

/**
 * Flujo de punta a punta contra PostgreSQL real con las migraciones del proyecto.
 * Semana usada: 21 al 27 de septiembre de 2026 (jornada 42 h → valor hora = salario/210,
 * recargo dominical 0,90), equivalente al caso de aceptación A de la nómina semanal.
 */
describe('Flujo completo (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let consulta: string;
  const ids = {
    proyecto: 0,
    otroProyecto: 0,
    ana: 0,
    luis: 0,
    liquidacion: 0,
    registroAna: 0,
    tipos: {} as Record<string, number>,
  };

  const http = () => request(app.getHttpServer());
  const con = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await reiniciarBaseDatos();
    app = await crearAppPruebas();
    admin = await iniciarSesion(app, 'admin@pruebas.co', 'Admin12345');
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('salud, autenticación y roles', () => {
    it('responde el healthcheck sin token', async () => {
      await http().get('/api/health').expect(200, { estado: 'ok', baseDatos: 'ok' });
    });

    it('rechaza peticiones sin token y credenciales inválidas', async () => {
      await http().get('/api/trabajadores').expect(401);
      await http().post('/api/auth/login').send({ email: 'admin@pruebas.co', password: 'malo' }).expect(401);
    });

    it('devuelve el perfil y renueva tokens', async () => {
      const yo = await http().get('/api/auth/me').set(con(admin)).expect(200);
      expect(yo.body).toMatchObject({ email: 'admin@pruebas.co', rol: 'ADMIN' });
      expect(yo.body.passwordHash).toBeUndefined();

      const login = await http()
        .post('/api/auth/login')
        .send({ email: 'ADMIN@pruebas.co ', password: 'Admin12345' });
      expect([200, 201]).toContain(login.status);
      const refresco = await http().post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
      expect([200, 201]).toContain(refresco.status);
      expect(refresco.body.accessToken).toEqual(expect.any(String));
    });

    it('crea usuarios por rol y aplica permisos', async () => {
      await http()
        .post('/api/usuarios')
        .set(con(admin))
        .send({ nombre: 'Consulta', email: 'consulta@pruebas.co', password: 'Consulta123', rol: 'CONSULTA' })
        .expect(201);
      await http()
        .post('/api/usuarios')
        .set(con(admin))
        .send({ nombre: 'Otro', email: 'consulta@pruebas.co', password: 'Consulta123', rol: 'CONSULTA' })
        .expect(409);
      consulta = await iniciarSesion(app, 'consulta@pruebas.co', 'Consulta123');

      await http().get('/api/trabajadores').set(con(consulta)).expect(200);
      await http().post('/api/proyectos').set(con(consulta)).send({}).expect(403);
      await http().get('/api/nomina/liquidaciones').set(con(consulta)).expect(403);
      await http().get('/api/auditoria').set(con(consulta)).expect(403);
    });
  });

  describe('maestros', () => {
    it('crea proyectos y valida duplicados', async () => {
      const base = { cliente: 'Electrificadora del Norte', ubicacion: 'Barranquilla', fechaInicio: '2026-09-01' };
      const p = await http()
        .post('/api/proyectos')
        .set(con(admin))
        .send({ ...base, codigo: 'PRY-001', nombre: 'Subestación 34,5 kV', presupuesto: 50_000_000 })
        .expect(201);
      ids.proyecto = p.body.id;
      const otro = await http()
        .post('/api/proyectos')
        .set(con(admin))
        .send({ ...base, codigo: 'PRY-002', nombre: 'Red de media tensión' })
        .expect(201);
      ids.otroProyecto = otro.body.id;
      await http().post('/api/proyectos').set(con(admin)).send({ ...base, codigo: 'PRY-001', nombre: 'X' }).expect(409);
      await http()
        .post('/api/proyectos')
        .set(con(admin))
        .send({ ...base, codigo: 'PRY-003', nombre: 'X', fechaFinPlaneada: '2026-08-01' })
        .expect(400);
    });

    it('crea trabajadores mensual y por hora', async () => {
      const comunes = { tipoDocumento: 'CC', tipoContrato: 'INDEFINIDO', cargo: 'Técnico electricista' };
      const ana = await http()
        .post('/api/trabajadores')
        .set(con(admin))
        .send({ ...comunes, nombre: 'Ana Torres', numeroDocumento: '1001', tipoSalario: 'MENSUAL', salarioBase: 2_100_000 })
        .expect(201);
      ids.ana = ana.body.id;
      expect(ana.body).toMatchObject({ tipoJornada: 'COMPLETA', aplicaAuxilioTransporte: true, estado: 'ACTIVO', salarioBase: 2_100_000 });

      const luis = await http()
        .post('/api/trabajadores')
        .set(con(admin))
        .send({ ...comunes, nombre: 'Luis Gómez', numeroDocumento: '1002', tipoSalario: 'POR_HORA', salarioBase: 12_000 })
        .expect(201);
      ids.luis = luis.body.id;

      await http()
        .post('/api/trabajadores')
        .set(con(admin))
        .send({ ...comunes, nombre: 'Dup', numeroDocumento: '1001', tipoSalario: 'MENSUAL', salarioBase: 1 })
        .expect(409);
      await http()
        .post('/api/trabajadores')
        .set(con(admin))
        .send({ ...comunes, nombre: 'Parcial', numeroDocumento: '1003', tipoSalario: 'MENSUAL', salarioBase: 900_000, tipoJornada: 'PARCIAL' })
        .expect(400);
    });

    it('asigna trabajadores al proyecto una sola vez', async () => {
      for (const trabajadorId of [ids.ana, ids.luis]) {
        await http()
          .post('/api/asignaciones')
          .set(con(admin))
          .send({ trabajadorId, proyectoId: ids.proyecto, rolEnProyecto: 'Montaje' })
          .expect(201);
      }
      await http()
        .post('/api/asignaciones')
        .set(con(admin))
        .send({ trabajadorId: ids.ana, proyectoId: ids.proyecto })
        .expect(409);

      const lista = await http().get(`/api/asignaciones?proyectoId=${ids.proyecto}`).set(con(admin)).expect(200);
      expect(lista.body).toHaveLength(2);
      expect(lista.body[0]).toMatchObject({ proyecto: { codigo: 'PRY-001' } });

      const historial = await http().get(`/api/trabajadores/${ids.ana}/asignaciones`).set(con(admin)).expect(200);
      expect(historial.body).toHaveLength(1);
    });

    it('elimina trabajadores y proyectos sin historial', async () => {
      const trabajador = await http()
        .post('/api/trabajadores')
        .set(con(admin))
        .send({
          tipoDocumento: 'CC',
          tipoContrato: 'INDEFINIDO',
          cargo: 'Temporal',
          nombre: 'Temporal Pérez',
          numeroDocumento: '9999',
          tipoSalario: 'MENSUAL',
          salarioBase: 1_000_000,
        })
        .expect(201);
      await http().delete(`/api/trabajadores/${trabajador.body.id}`).set(con(admin)).expect(204);
      await http().get(`/api/trabajadores/${trabajador.body.id}`).set(con(admin)).expect(404);

      const proyecto = await http()
        .post('/api/proyectos')
        .set(con(admin))
        .send({ codigo: 'PRY-TEMP', nombre: 'Temporal', fechaInicio: '2026-09-01' })
        .expect(201);
      await http().delete(`/api/proyectos/${proyecto.body.id}`).set(con(admin)).expect(204);
      await http().get(`/api/proyectos/${proyecto.body.id}`).set(con(admin)).expect(404);
    });

    it('expone los tipos de hora con el recargo vigente por fecha', async () => {
      const junio = await http().get('/api/tipos-hora?fecha=2026-06-15').set(con(admin)).expect(200);
      const septiembre = await http().get('/api/tipos-hora?fecha=2026-09-21').set(con(admin)).expect(200);
      const recargo = (lista: { codigo: string; recargo: number }[], codigo: string) =>
        lista.find((t) => t.codigo === codigo)?.recargo;

      expect(recargo(junio.body, 'DOM')).toBe(0.8);
      expect(recargo(septiembre.body, 'DOM')).toBe(0.9);
      expect(recargo(septiembre.body, 'HEDD')).toBe(1.15);
      expect(recargo(septiembre.body, 'HEDN')).toBe(1.65);
      for (const t of septiembre.body as { codigo: string; id: number }[]) ids.tipos[t.codigo] = t.id;
    });
  });

  describe('registro de horas', () => {
    const horas = (codigo: string, cantidad: number) => ({ tipoHoraId: ids.tipos[codigo], horas: cantidad });

    it('guarda las horas de cada día de la semana por lote y devuelve alertas legales', async () => {
      const ana = [
        { fecha: '2026-09-27', detalles: [horas('DOM', 2)] },
        { fecha: '2026-09-21', detalles: [horas('NOC', 3)] },
        { fecha: '2026-09-22', detalles: [horas('HED', 4)] },
      ].map((r) => ({ ...r, trabajadorId: ids.ana, proyectoId: ids.proyecto }));
      const luis = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].map((fecha) => ({
        trabajadorId: ids.luis,
        proyectoId: ids.proyecto,
        fecha,
        detalles: fecha === '2026-09-23' ? [horas('ORD', 8), horas('NOC', 4)] : [horas('ORD', 8)],
      }));

      const respuesta = await http()
        .put('/api/registro-horas/lote')
        .set(con(admin))
        .send({ registros: [...ana, ...luis] })
        .expect(200);
      expect(respuesta.body).toMatchObject({ creados: 8, actualizados: 0, eliminados: 0 });
      expect(respuesta.body.alertas.join(' ')).toMatch(/Ana Torres/);
      expect(respuesta.body.alertas.join(' ')).toMatch(/Luis Gómez/);
    });

    it('rechaza duplicados, fechas futuras, horas inválidas y trabajo sin asignación', async () => {
      const base = { trabajadorId: ids.ana, proyectoId: ids.proyecto, detalles: [{ tipoHoraId: ids.tipos.ORD, horas: 1 }] };
      await http().post('/api/registro-horas').set(con(admin)).send({ ...base, fecha: '2026-09-21' }).expect(409);
      await http().post('/api/registro-horas').set(con(admin)).send({ ...base, fecha: '2099-01-01' }).expect(400);
      await http()
        .post('/api/registro-horas')
        .set(con(admin))
        .send({ ...base, fecha: '2026-09-28', detalles: [{ tipoHoraId: ids.tipos.ORD, horas: -2 }] })
        .expect(400);
      await http()
        .post('/api/registro-horas')
        .set(con(admin))
        .send({ ...base, fecha: '2026-09-28', detalles: [{ tipoHoraId: ids.tipos.ORD, horas: 25 }] })
        .expect(400);
      await http()
        .post('/api/registro-horas')
        .set(con(admin))
        .send({ ...base, proyectoId: ids.otroProyecto, fecha: '2026-09-28' })
        .expect(400);
      await http().post('/api/registro-horas').set(con(consulta)).send({ ...base, fecha: '2026-09-28' }).expect(403);
    });

    it('lista y pagina registros con detalle por tipo', async () => {
      const lista = await http()
        .get(`/api/registro-horas?trabajadorId=${ids.ana}&desde=2026-09-01&hasta=2026-09-30&limite=2`)
        .set(con(admin))
        .expect(200);
      expect(lista.body).toMatchObject({ total: 3, pagina: 1, limite: 2 });
      expect(lista.body.datos).toHaveLength(2);
      const delDia = await http()
        .get(`/api/registro-horas?trabajadorId=${ids.ana}&desde=2026-09-21&hasta=2026-09-21`)
        .set(con(admin))
        .expect(200);
      const registro = delDia.body.datos[0];
      expect(registro).toMatchObject({ totalHoras: 3, trabajador: { nombre: 'Ana Torres' }, proyecto: { codigo: 'PRY-001' } });
      expect(registro.detalles[0]).toMatchObject({ codigo: 'NOC', horas: 3 });
      ids.registroAna = registro.id;
    });
  });

  describe('nómina', () => {
    it('liquida la semana con los valores exactos', async () => {
      const respuesta = await http()
        .post('/api/nomina/liquidaciones')
        .set(con(admin))
        .send({ fecha: '2026-09-23' })
        .expect(201);
      ids.liquidacion = respuesta.body.id;
      expect(respuesta.body).toMatchObject({
        anio: 2026,
        fechaInicio: '2026-09-21',
        fechaFin: '2026-09-27',
        estado: 'BORRADOR',
        numeroTrabajadores: 2,
        requiereRecalculo: false,
      });

      const porNombre = (nombre: string) =>
        respuesta.body.nominas.find((n: { nombreTrabajador: string }) => n.nombreTrabajador === nombre);
      expect(porNombre('Ana Torres')).toMatchObject({
        diasLaborados: 7,
        ibc: 568_500,
        totalDevengado: 626_622,
        totalDeducciones: 45_480,
        netoPagar: 581_142,
      });
      // Luis trabajó 5 días: auxilio de transporte de 5/30.
      expect(porNombre('Luis Gómez')).toMatchObject({
        diasLaborados: 5,
        ibc: 544_800,
        totalDevengado: 586_316,
        totalDeducciones: 43_584,
        netoPagar: 542_732,
      });
      expect(respuesta.body.totalNeto).toBe(581_142 + 542_732);
    });

    it('detalla los conceptos del desprendible', async () => {
      const liquidacion = await http().get(`/api/nomina/liquidaciones/${ids.liquidacion}`).set(con(admin)).expect(200);
      const nominaAna = liquidacion.body.nominas.find((n: { nombreTrabajador: string }) => n.nombreTrabajador === 'Ana Torres');
      const desprendible = await http().get(`/api/nomina/desprendibles/${nominaAna.id}`).set(con(admin)).expect(200);

      const valor = (codigo: string) =>
        desprendible.body.conceptos.find((c: { codigo: string }) => c.codigo === codigo)?.valor;
      expect(valor('SALARIO')).toBe(490_000);
      expect(valor('RECARGO_NOC')).toBe(10_500);
      expect(valor('RECARGO_DOM')).toBe(18_000);
      expect(valor('HORAS_HED')).toBe(50_000);
      expect(valor('AUX_TRANSPORTE')).toBe(58_122);
      expect(valor('SALUD')).toBe(22_740);
      expect(valor('PENSION')).toBe(22_740);
      expect(desprendible.body).toMatchObject({ valorHora: 10_000, liquidacion: { id: ids.liquidacion } });
      expect(desprendible.body.parametros).toMatchObject({ smmlv: 1_750_905, jornadaMaximaSemanal: 42 });
    });

    it('exige recalcular tras cambios y bloquea el periodo al cerrar', async () => {
      await http()
        .patch(`/api/registro-horas/${ids.registroAna}`)
        .set(con(admin))
        .send({ detalles: [{ tipoHoraId: ids.tipos.NOC, horas: 3 }], observacion: 'Turno de pruebas' })
        .expect(200);
      const marcada = await http().get(`/api/nomina/liquidaciones/${ids.liquidacion}`).set(con(admin)).expect(200);
      expect(marcada.body.requiereRecalculo).toBe(true);

      await http().post(`/api/nomina/liquidaciones/${ids.liquidacion}/cerrar`).set(con(admin)).expect(409);
      const recalculada = await http()
        .post(`/api/nomina/liquidaciones/${ids.liquidacion}/recalcular`)
        .set(con(admin));
      expect([200, 201]).toContain(recalculada.status);
      expect(recalculada.body.requiereRecalculo).toBe(false);

      const cerrada = await http().post(`/api/nomina/liquidaciones/${ids.liquidacion}/cerrar`).set(con(admin));
      expect([200, 201]).toContain(cerrada.status);
      expect(cerrada.body.estado).toBe('CERRADA');

      await http()
        .patch(`/api/registro-horas/${ids.registroAna}`)
        .set(con(admin))
        .send({ detalles: [{ tipoHoraId: ids.tipos.HED, horas: 1 }] })
        .expect(409);
      await http().delete(`/api/registro-horas/${ids.registroAna}`).set(con(admin)).expect(409);
      await http().delete(`/api/nomina/liquidaciones/${ids.liquidacion}`).set(con(admin)).expect(409);
      await http()
        .post('/api/nomina/liquidaciones')
        .set(con(admin))
        .send({ fecha: '2026-09-22' })
        .expect(409);
    });

    it('exporta el consolidado y el desprendible', async () => {
      const binario = (r: request.Test) =>
        r.buffer(true).parse((res, fin) => {
          const partes: Buffer[] = [];
          res.on('data', (c: Buffer) => partes.push(c));
          res.on('end', () => fin(null, Buffer.concat(partes)));
        });

      const excel = await binario(http().get(`/api/nomina/liquidaciones/${ids.liquidacion}/excel`).set(con(admin))).expect(200);
      expect((excel.body as Buffer).subarray(0, 2).toString()).toBe('PK');
      expect(excel.headers['content-disposition']).toMatch(/attachment/);

      const pdf = await binario(http().get(`/api/nomina/liquidaciones/${ids.liquidacion}/pdf`).set(con(admin))).expect(200);
      expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

      const liquidacion = await http().get(`/api/nomina/liquidaciones/${ids.liquidacion}`).set(con(admin)).expect(200);
      const desprendible = await binario(
        http().get(`/api/nomina/desprendibles/${liquidacion.body.nominas[0].id}/pdf`).set(con(admin)),
      ).expect(200);
      expect((desprendible.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('operación del proyecto', () => {
    it('gestiona los materiales del proyecto', async () => {
      const material = await http()
        .post(`/api/proyectos/${ids.proyecto}/materiales`)
        .set(con(admin))
        .send({ nombre: 'Cable 4/0 AWG', unidadMedida: 'm', cantidadSolicitada: 300, precioUnitario: 12_500 })
        .expect(201);
      expect(material.body).toMatchObject({ nombre: 'Cable 4/0 AWG', precioUnitario: 12_500, costo: 3_750_000 });
      // El precio es obligatorio.
      await http()
        .post(`/api/proyectos/${ids.proyecto}/materiales`)
        .set(con(admin))
        .send({ nombre: 'Sin precio', unidadMedida: 'm', cantidadSolicitada: 1 })
        .expect(400);
      const editado = await http()
        .patch(`/api/materiales/${material.body.id}`)
        .set(con(admin))
        .send({ precioUnitario: 10_000 })
        .expect(200);
      expect(editado.body).toMatchObject({ precioUnitario: 10_000, costo: 3_000_000 });
      const lista = await http().get(`/api/proyectos/${ids.proyecto}/materiales`).set(con(admin)).expect(200);
      expect(lista.body).toHaveLength(1);
    });
  });

  describe('reportes y auditoría', () => {
    it('calcula horas y costo de mano de obra del mes', async () => {
      const reporte = await http()
        .get('/api/reportes/horas?desde=2026-09-01&hasta=2026-09-30&agrupacion=trabajador')
        .set(con(admin))
        .expect(200);
      // Ana: 50.000 + 40.500 + 38.000; Luis: 480.000 + 64.800.
      expect(reporte.body.totales).toMatchObject({ horas: 53, horasExtra: 4, costo: 673_300 });

      const costos = await http()
        .get('/api/reportes/costos-proyectos?desde=2026-09-01&hasta=2026-09-30')
        .set(con(admin))
        .expect(200);
      expect(costos.body.total).toBe(673_300);

      await http().get('/api/reportes/horas?desde=2026-09-30&hasta=2026-09-01').set(con(admin)).expect(400);
    });

    it('reporta los excesos de horas extra y jornada', async () => {
      const respuesta = await http()
        .get('/api/reportes/alertas-horas-extra?desde=2026-09-01&hasta=2026-09-30')
        .set(con(admin))
        .expect(200);
      const tipos = respuesta.body.alertas.map((a: { tipo: string; nombre: string }) => `${a.tipo}:${a.nombre}`);
      expect(tipos).toContain('JORNADA_SEMANA:Luis Gómez');
      expect(tipos).toContain('EXTRA_DIA:Ana Torres');
    });

    it('arma el resumen del proyecto y el dashboard', async () => {
      const resumen = await http()
        .get(`/api/reportes/proyectos/${ids.proyecto}/resumen`)
        .set(con(admin))
        .expect(200);
      expect(resumen.body).toMatchObject({
        costoManoObra: 673_300,
        costoMateriales: 3_000_000,
        gastoTotal: 3_673_300,
        horas: { total: 53 },
      });

      const dashboard = await http().get('/api/reportes/dashboard').set(con(consulta)).expect(200);
      expect(dashboard.body).toMatchObject({ proyectosActivos: 2, trabajadoresActivos: 2, ultimaLiquidacion: null });
      const dashboardAdmin = await http().get('/api/reportes/dashboard').set(con(admin)).expect(200);
      expect(dashboardAdmin.body.ultimaLiquidacion).toMatchObject({ id: ids.liquidacion });

      await http().get('/api/reportes/nomina-periodos?anio=2026').set(con(consulta)).expect(403);
    });

    it('deja trazabilidad de horas y nómina', async () => {
      const horas = await http().get('/api/auditoria?entidad=RegistroHoras').set(con(admin)).expect(200);
      expect(horas.body.total).toBeGreaterThanOrEqual(8);
      const nomina = await http().get('/api/auditoria?entidad=LiquidacionNomina').set(con(admin)).expect(200);
      const acciones = nomina.body.datos.map((a: { accion: string }) => a.accion);
      expect(acciones).toEqual(expect.arrayContaining(['CALCULAR', 'CERRAR']));
      expect(nomina.body.datos[0].usuarioEmail).toBe('admin@pruebas.co');
    });
  });

  describe('eliminación con todas sus relaciones', () => {
    const SEMANA = '2026-09-14';

    it('elimina un trabajador con horas, asignaciones y nómina, y recalcula los totales', async () => {
      const comunes = { tipoDocumento: 'CC', tipoContrato: 'INDEFINIDO', cargo: 'Auxiliar', tipoSalario: 'MENSUAL' };
      const trabajador = await http()
        .post('/api/trabajadores')
        .set(con(admin))
        .send({ ...comunes, nombre: 'Borrar Pérez', numeroDocumento: '7777', salarioBase: 1_800_000 })
        .expect(201);
      const proyecto = await http()
        .post('/api/proyectos')
        .set(con(admin))
        .send({ codigo: 'PRY-BORRAR', nombre: 'Para borrar', cliente: 'X', ubicacion: 'Y', fechaInicio: '2026-09-01' })
        .expect(201);
      for (const trabajadorId of [trabajador.body.id, ids.ana]) {
        await http().post('/api/asignaciones').set(con(admin)).send({ trabajadorId, proyectoId: proyecto.body.id }).expect(201);
        await http()
          .post('/api/registro-horas')
          .set(con(admin))
          .send({ trabajadorId, proyectoId: proyecto.body.id, fecha: SEMANA, detalles: [{ tipoHoraId: ids.tipos.ORD, horas: 8 }] })
          .expect(201);
      }
      const liquidacion = await http().post('/api/nomina/liquidaciones').set(con(admin)).send({ fecha: SEMANA }).expect(201);
      expect(liquidacion.body.numeroTrabajadores).toBe(2);

      // Con horas, asignación y nómina: se elimina todo.
      await http().delete(`/api/trabajadores/${trabajador.body.id}`).set(con(admin)).expect(204);
      await http().get(`/api/trabajadores/${trabajador.body.id}`).set(con(admin)).expect(404);
      const horas = await http().get(`/api/registro-horas?trabajadorId=${trabajador.body.id}`).set(con(admin)).expect(200);
      expect(horas.body.total).toBe(0);
      const despues = await http().get(`/api/nomina/liquidaciones/${liquidacion.body.id}`).set(con(admin)).expect(200);
      expect(despues.body).toMatchObject({ numeroTrabajadores: 1, requiereRecalculo: true });
      expect(despues.body.totalNeto).toBe(despues.body.nominas[0].netoPagar);

      // Proyecto con horas y asignaciones: también.
      await http().delete(`/api/proyectos/${proyecto.body.id}`).set(con(admin)).expect(204);
      await http().get(`/api/proyectos/${proyecto.body.id}`).set(con(admin)).expect(404);
      const horasProyecto = await http().get(`/api/registro-horas?proyectoId=${proyecto.body.id}`).set(con(admin)).expect(200);
      expect(horasProyecto.body.total).toBe(0);
      // Ana sigue existiendo y conserva sus asignaciones y horas de los demás proyectos.
      await http().get(`/api/trabajadores/${ids.ana}`).set(con(admin)).expect(200);
      const asignacionesAna = await http().get(`/api/trabajadores/${ids.ana}/asignaciones`).set(con(admin)).expect(200);
      expect(asignacionesAna.body).toHaveLength(1);
    });
  });
});
