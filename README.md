# Gestión de Proyectos y Nómina — API

API REST para gestionar proyectos de ingeniería eléctrica, registro de horas y liquidación de nómina colombiana.

**Stack:** NestJS 12 (ESM) · TypeORM 1 · PostgreSQL 16 · TypeScript 6 · Vitest · Despliegue en Railway.
Contrato de la API: [`docs/API.md`](https://github.com/escano1/gestion-proyecto-claude/blob/main/docs/API.md) en el repositorio de lineamientos. Documentación interactiva (Swagger): `/api/docs`.

## Desarrollo local

Requisitos: Node.js 24.15+ (recomendado, igual que Docker y CI) o 22.22.3+ de la línea 22, y Docker.

```bash
cp .env.example .env          # genera JWT_SECRET y JWT_REFRESH_SECRET propios
npm ci
npm run db:up                 # PostgreSQL 16 en localhost:5432 (+ base de pruebas)
npm run migration:run         # esquema + tipos de hora + parámetros legales
npm run start:dev             # http://localhost:3001/api
```

Al arrancar con la tabla `usuarios` vacía se crea el administrador definido en `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### Usuarios y datos de prueba

Con el API corriendo, `npm run seed:demo` crea un usuario por rol y datos de ejemplo (3 proyectos, 4 trabajadores, ~45 días de horas, una liquidación en borrador, materiales, herramientas, hitos y bitácora). Es idempotente y se niega a correr contra un API que no sea local.

| Rol | Correo | Contraseña | Qué puede hacer |
|---|---|---|---|
| Administrador | `ADMIN_EMAIL` (`admin@empresa.com`) | `ADMIN_PASSWORD` (`CambiarEsta123*`) | Todo, incluidos usuarios y auditoría |
| Gestor de proyectos | `gestor@empresa.com` | `Gestor12345` | Proyectos, asignaciones, horas, materiales, herramientas, hitos y bitácora |
| Nómina | `nomina@empresa.com` | `Nomina12345` | Trabajadores, horas, nómina y parámetros legales |
| Consulta | `consulta@empresa.com` | `Consulta123` | Solo lectura (sin nómina, usuarios ni auditoría) |

Son credenciales de desarrollo: no ejecute el seed en producción.

| Script | Uso |
|---|---|
| `npm run start:dev` | Servidor con recarga |
| `npm run build` / `npm run start:prod` | Compilar y ejecutar `dist/` |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:e2e` | Pruebas de punta a punta contra `TEST_DATABASE_URL` |
| `npm run lint` · `npm run typecheck` | oxlint y TypeScript |
| `npm run migration:generate -- src/database/migrations/Nombre` | Generar migración tras cambiar entidades |
| `npm run migration:run` / `migration:revert` | Aplicar / revertir migraciones |
| `npm run seed:demo` | Usuarios por rol y datos de ejemplo (solo local) |

> Las migraciones se registran explícitamente en `src/database/migraciones.ts` (y las entidades en `src/database/entidades.ts`): agregue ahí cada archivo nuevo.

## Estructura

```
src/
├── main.ts · app.module.ts · configurar-app.ts   # arranque, guards globales, CORS, Swagger
├── config/          # validación de entorno y opciones de PostgreSQL
├── database/        # entidades, migraciones, data source de la CLI, nombres snake_case
├── common/          # guards JWT/roles, decoradores, filtros de errores, utilidades de fecha y dinero
└── modules/
    ├── auth · usuarios                 # JWT (acceso 15 min + refresh 7 días), roles, admin inicial
    ├── trabajadores · proyectos · asignaciones
    ├── tipos-hora · parametros         # parámetros legales con fecha de vigencia
    ├── registro-horas                  # captura diaria/por lotes, validaciones y alertas legales
    ├── nomina                          # motor de liquidación (calculo/) y exportaciones PDF/Excel
    ├── materiales · herramientas · hitos · bitacora
    ├── reportes                        # dashboard, horas, costos, alertas, avance
    └── auditoria                       # quién, cuándo y qué cambió
```

## Reglas de nómina

Los valores legales **no están en el código**: viven en la tabla `parametros_legales` con fecha de vigencia y se editan desde *Configuración › Parámetros legales*. Un cálculo usa el valor vigente en la fecha de cada hora trabajada. La migración `DatosIniciales` siembra:

| Parámetro | Valores sembrados |
|---|---|
| SMMLV / auxilio de transporte | 2024, 2025 y 2026 ($1.750.905 / $249.095 — Decretos 1469 y 1470 de 2025) |
| UVT | 2024, 2025 y 2026 ($52.374 — Res. DIAN 000238 de 2025) |
| Jornada máxima (Ley 2101 de 2021) | 47 h → 46 h (15-jul-2024) → 44 h (15-jul-2025) → **42 h (15-jul-2026)** |
| Recargo dominical/festivo (Ley 2466 de 2025) | 75 % → 80 % (1-jul-2025) → **90 % (1-jul-2026)** → 100 % (1-jul-2027) |
| Nocturno · extra diurna · extra nocturna | 35 % · 25 % · 75 % |
| Aportes del trabajador | Salud 4 % · Pensión 4 % |
| Límites de alerta | 2 h extra/día · 12 h extra/semana |

Resumen del cálculo (`src/modules/nomina/calculo/`):
- **Valor hora** = salario mensual ÷ (jornada semanal × 5) → con 42 h: salario ÷ 210. Los salarios por hora usan su tarifa.
- **Salario mensual:** se paga por días (convención de 30 días); las horas ordinarias dentro de la jornada ya están incluidas y solo se pagan los recargos. **Horas extra** y **salario por hora:** valor hora × (1 + recargo).
- El recargo dominical se suma a nocturno y extras (p. ej. extra dominical nocturna = 75 % + 90 %).
- **Auxilio de transporte** si el salario ≤ 2 SMMLV, proporcional a los días; no forma parte del IBC.
- **Deducciones:** salud y pensión sobre el IBC (tope 25 SMMLV), Fondo de Solidaridad Pensional (1 %–2 % desde 4 SMMLV) y retención en la fuente por procedimiento 1 (art. 383 E.T., renta exenta del 25 % con tope de 790 UVT/año).
- Las liquidaciones se crean en **borrador**; cualquier cambio de horas, salarios o parámetros las marca para recálculo. Al **cerrarlas** se bloquea la edición de horas del periodo.

Fuera de alcance por ahora (requieren datos que el sistema no registra): incapacidades, licencias y vacaciones; prestaciones sociales (prima, cesantías) y aportes del empleador; salario integral; deducciones por dependientes, intereses de vivienda o medicina prepagada en la retención.

## Despliegue en Railway

El repositorio incluye `Dockerfile` (multi-etapa, Node 24) y `railway.json` (healthcheck `/api/health` y migraciones en *pre-deploy*).

1. En Railway: **New Project → Deploy from GitHub repo** → `escano1/gestion-proyecto-backend`.
2. **+ New → Database → PostgreSQL** en el mismo proyecto.
3. Variables del servicio de la API:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (red privada; deje `DB_SSL=false`) |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET`, `JWT_REFRESH_SECRET` | dos cadenas aleatorias distintas de 64+ caracteres |
   | `CORS_ORIGINS` | `https://<su-app>.vercel.app` (agregue `https://*.vercel.app` solo si quiere habilitar los *previews*) |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE` | administrador inicial (cambie la clave tras el primer ingreso) |
   | `EMPRESA_NOMBRE`, `EMPRESA_NIT` | encabezado de los desprendibles |

   `PORT` lo asigna Railway. Swagger queda desactivado en producción salvo `SWAGGER_ENABLED=true`.
4. **Settings → Networking → Generate Domain** y use esa URL + `/api` como `NEXT_PUBLIC_API_URL` en Vercel.
5. Cada *push* a `main` construye la imagen, ejecuta `npm run migration:run:prod` y, si el healthcheck responde, publica la nueva versión.

Respaldos: active los *backups* del servicio PostgreSQL en Railway. Los adjuntos de la bitácora se guardan en la base de datos (el disco del contenedor es efímero), así que quedan incluidos.

## Pruebas

```bash
npm test            # unitarias: motor de nómina, retención, FSP, periodos, alertas, costos, reglas de negocio
npm run test:e2e    # requiere la base gestion_proyectos_test (la crea docker compose la primera vez)
```

Si el volumen de Docker ya existía antes de agregar la base de pruebas:
`docker exec gestion-proyecto-db createdb -U gestion gestion_proyectos_test`.
