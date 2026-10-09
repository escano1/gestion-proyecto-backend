# 💻 Backend - NestJS + PostgreSQL

API RESTful para sistema de gestión de proyectos y nómina colombiana.

**Stack**: NestJS 10+ | TypeORM | PostgreSQL | TypeScript | JWT  
**Puertos**: `3000` (API) | `5432` (DB)

---

## 🎯 Propósito

Proporcionar API robusta, validada y auditable para:
- Autenticación y autorización (JWT)
- CRUD de trabajadores, proyectos, asignaciones
- Registro de horas con validaciones legales
- Cálculo automático de nómina colombiana
- Reportes y exports (PDF, Excel)
- Auditoría completa de cambios

---

## 📁 Estructura

```
src/
├── main.ts                          # Punto de entrada
├── app.module.ts                    # Módulo raíz
│
├── modules/                         # Módulos por feature
│   ├── auth/                        # Autenticación JWT
│   ├── usuario/                     # Gestión de usuarios
│   ├── trabajador/                  # CRUD trabajadores
│   ├── proyecto/                    # CRUD proyectos
│   ├── asignacion-proyecto/         # Relación trabajador-proyecto
│   ├── tipo-hora/                   # Configuración de tipos de hora
│   ├── registro-horas/              # Captura de horas (CRÍTICO)
│   ├── nomina/                      # Motor de nómina (CRÍTICO)
│   │   ├── calculators/
│   │   │   ├── hora.calculator.ts
│   │   │   ├── deduccion.calculator.ts
│   │   │   └── retencion.calculator.ts
│   │   ├── services/
│   │   │   ├── nomina.service.ts
│   │   │   ├── pdf-generator.service.ts
│   │   │   └── excel-generator.service.ts
│   │   └── tests/
│   │       └── nomina.service.spec.ts  (50+ tests)
│   ├── reporte/                     # Reportes y dashboards
│   ├── auditoria/                   # Log de cambios
│   └── material-herramienta/        # Materiales y herramientas
│
├── database/
│   ├── entities/                    # Entidades TypeORM
│   ├── migrations/                  # Versionado de BD
│   └── seeders/                     # Data inicial
│
├── common/
│   ├── decorators/                  # @Roles, @IsOwner, etc.
│   ├── guards/                      # JwtAuthGuard, RolesGuard
│   ├── filters/                     # Error handling
│   ├── interceptors/                # Logging, transformación
│   ├── pipes/                       # Validación custom
│   └── exceptions/                  # CustomException
│
└── config/
    ├── database.config.ts           # PostgreSQL connection
    ├── jwt.config.ts                # JWT configuration
    ├── nomina-parametros.ts         # Parámetros legales Colombia
    └── app.config.ts                # App configuration
```

---

## 🚀 Quick Start

### 1. Instalar Dependencias

```bash
npm install

# O con Yarn
yarn install
```

### 2. Configurar Ambiente

Crear `.env.local`:

```
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=gestion_usuarios
DB_PASSWORD=tu_contraseña_segura
DB_NAME=gestion_proyectos_db

# Autenticación
JWT_SECRET=tu_jwt_secret_muy_largo_y_seguro_aqui
JWT_EXPIRATION=900s

# Aplicación
NODE_ENV=development
PORT=3000
```

### 3. Iniciar Base de Datos

```bash
# Con Docker (recomendado)
docker-compose up -d

# O PostgreSQL local (ver puerto y credenciales en .env.local)
```

### 4. Ejecutar Migrations

```bash
npm run typeorm migration:run
```

### 5. Iniciar Desarrollo

```bash
npm run start:dev

# Debería salir:
# [NestFactory] Nest application successfully started
# Listening on port 3000
```

Verificar en: `http://localhost:3000/api/health`

---

## 🔑 Autenticación

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "password123"
}

Response: {
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "usuario": { "id": 1, "nombre": "Juan", "rol": "admin" }
}
```

### Usar Token en Requests

```bash
GET /api/trabajadores
Authorization: Bearer eyJhbGc...
```

### Token Expiration

- **Access Token**: 15 minutos
- **Refresh Token**: 7 días
- Refresh automático en cliente

---

## 📚 Módulos Disponibles

### Auth
```
POST   /api/auth/login              # Login
POST   /api/auth/register           # Registro
POST   /api/auth/refresh            # Refresh token
```

### Trabajadores
```
GET    /api/trabajadores             # Lista
GET    /api/trabajadores/:id         # Detalle
POST   /api/trabajadores             # Crear (require: admin, gestor)
PUT    /api/trabajadores/:id         # Actualizar
DELETE /api/trabajadores/:id         # Eliminar
```

### Proyectos
```
GET    /api/proyectos
GET    /api/proyectos/:id
POST   /api/proyectos                # Crear (require: admin, gestor)
PUT    /api/proyectos/:id            # Actualizar
DELETE /api/proyectos/:id            # Eliminar
```

### Registro de Horas (CRÍTICO)
```
POST   /api/registro-horas           # Crear registro
GET    /api/registro-horas/periodo   # Por período (mes/año)
GET    /api/registro-horas/:id       # Detalle
PUT    /api/registro-horas/:id       # Actualizar
DELETE /api/registro-horas/:id       # Eliminar (con auditoría)
```

**Validaciones**:
- Máximo 12 horas/día
- Máximo 80 horas extras/semana
- No permitir duplicados (trabajador, proyecto, fecha, tipo_hora)

### Nómina (CRÍTICO)
```
POST   /api/nomina/calcular          # Calcular para período (require: nómina)
GET    /api/nomina                   # Lista
GET    /api/nomina/:id               # Detalle
GET    /api/nomina/:id/pdf           # Descargar PDF
GET    /api/nomina/:id/excel         # Descargar Excel
```

**Validaciones**:
- No permitir nómina duplicada
- Validar que existan registros de horas
- Trabajador debe estar activo

---

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests específicos
npm test -- nomina.service.spec

# Con cobertura
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Estructura de Tests

```typescript
describe('TrabajadorService', () => {
  let service: TrabajadorService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TrabajadorService],
    }).compile();
    
    service = module.get<TrabajadorService>(TrabajadorService);
  });
  
  it('debe crear un trabajador', async () => {
    // Test...
  });
});
```

### Coverage Requerido

```
Servicios:          80%+
Nómina:             85%+
Controladores:      70%+
```

---

## 🗄️ Base de Datos

### Entidades Principales

```
usuario             # Usuarios de sistema (admin, gestor, nómina)
trabajador          # Empleados
proyecto            # Proyectos de ingeniería
asignacion_proyecto # Trabajador asignado a proyecto (N-M)
tipo_hora           # Configuración: ordinaria, nocturna, extras, etc.
registro_horas      # Diario de horas trabajadas (CRÍTICO)
nomina              # Nómina calculada por período
detalle_nomina      # Línea por línea de cálculo (auditoría)
log_auditoria       # Historial de cambios
```

### Migrations

```bash
# Ver migrations
npm run typeorm migration:show

# Ejecutar
npm run typeorm migration:run

# Generar automática (después de cambiar entity)
npm run typeorm migration:generate src/database/migrations/[Nombre]

# Revertir última
npm run typeorm migration:revert
```

### Tipos de Datos Críticos

```typescript
// Dinero: SIEMPRE decimal(12,2)
salarioBase: decimal(12,2)      // $999,999,999.99

// Horas: decimal(5,2)
cantidadHoras: decimal(5,2)     // 12.50

// NO usar float/double para dinero
```

---

## 🔒 Seguridad

### Autenticación
- JWT con access + refresh tokens
- Contraseñas: bcrypt (10+ salts)
- Expiración y refresh automático

### Autorización
```typescript
@UseGuards(JwtAuthGuard)           // Requiere login
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'nómina')          // Requiere rol específico
```

### Validación
```typescript
@Post()
@UsePipes(ValidationPipe)
crear(@Body() dto: CreateTrabajadorDto) {
  // class-validator valida automáticamente
}
```

### Auditoría
```typescript
// Automático en módulo auditoria
await this.auditoriaService.crear({
  tablaNombre: 'registro_horas',
  accion: 'INSERT',
  datosNuevos: registro,
  usuarioId: req.user.id
});
```

---

## 🎯 Desarrollo de Módulo Nuevo

### Con Skill `setup-nest-module`

```bash
# Define parámetros
moduleName: material
fields:
  - name: nombre
    type: string
    required: true
  - name: cantidad
    type: number
    required: true
hasRepository: true
```

Genera automáticamente:
- Entity + TypeORM decorators
- Create/Update DTOs
- Service con CRUD
- Controller con guards
- Tests básicos

### Manual (paso a paso)

1. Crear `src/modules/[feature]/entities/[feature].entity.ts`
2. Crear DTOs en `src/modules/[feature]/dto/`
3. Crear `[feature].service.ts`
4. Crear `[feature].controller.ts`
5. Crear `[feature].module.ts`
6. Importar en `app.module.ts`
7. Crear tests en `[feature].service.spec.ts`

---

## 🚀 Comandos Disponibles

```bash
npm run start              # Producción
npm run start:dev         # Desarrollo (hot reload)
npm run build             # Compilar TypeScript
npm test                  # Tests
npm test -- --coverage    # Con cobertura
npm run lint              # ESLint
npm run format            # Prettier
npm run type-check        # TypeScript check

# Base de datos
npm run typeorm migration:run        # Ejecutar migrations
npm run typeorm migration:revert     # Revertir última
npm run typeorm migration:show       # Ver estado
```

---

## 🔍 Debugging

### Logs en Desarrollo

```typescript
// Winston logger (automático en NestJS)
this.logger.log('Mensaje');
this.logger.warn('Advertencia');
this.logger.error('Error', error.stack);
```

### Error Handling

```typescript
// Errores custom
throw new BadRequestException('Validación falló');
throw new NotFoundException('No encontrado');
throw new UnauthorizedException('No autorizado');
throw new ForbiddenException('Acceso denegado');
```

### Debugging con VSCode

Crear `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "NestJS Debug",
      "program": "${workspaceFolder}/node_modules/.bin/nest",
      "args": ["start", "--debug", "--watch"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## 📊 Parámetros Legales (Colombia 2026)

Archivo: `src/config/nomina-parametros.ts`

```typescript
export const RECARGOS = {
  ORDINARIA: 0,           // 0%
  NOCTURNA: 0.35,        // +35%
  EXTRA_DIURNA: 0.25,    // +25%
  // ... etc
};

export const DEDUCCIONES = {
  SALUD: 0.04,    // 4%
  PENSION: 0.04,  // 4%
  // ... etc
};
```

Cambios requieren:
1. Actualizar archivo
2. Agregar tests
3. Ejecutar suite completa
4. Validar con especialista laboral

---

## 🔗 Referencias

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [JWT.io](https://jwt.io)

---

## 📋 Checklist: Antes de Push

- [ ] Tests pasando: `npm test`
- [ ] TypeScript sin errores: `npm run type-check`
- [ ] Linting correcto: `npm run lint`
- [ ] Coverage >= 80% (85% en módulos críticos)
- [ ] No hay `console.log` (usar logger)
- [ ] Commits descriptivos
- [ ] Sin `any` en TypeScript

---

## 🤖 Agentes Claude Disponibles

Para ayuda especializada:

```
@backend-dev "Crea el servicio para [feature]"
@nomina-specialist "Implementa el cálculo de [concepto]"
@database-admin "Crea entidad [nombre]"
@qa-tester "Escribe tests para [módulo]"
```

---

**Estado**: 📋 Documentación completada (desarrollo pendiente)  
**Próximo**: Fase 0 - Setup inicial  
**Actualizado**: 2026-10-08
