# API - Plataforma Escolar

Backend NestJS de la plataforma escolar.

## Stack

- NestJS 11
- Prisma + PostgreSQL
- JWT (access + refresh)
- Socket.IO
- Validacion global con class-validator

## Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL 16 (local con Docker o servicio gestionado)

## Variables de entorno

Copia `apps/api/.env.example` a `apps/api/.env` y ajusta valores:

```env
PORT=4000
NODE_ENV=development
JWT_ACCESS_SECRET=<obligatoria>
JWT_REFRESH_SECRET=<obligatoria>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
TRUST_PROXY=false
BODY_LIMIT=1mb
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_db?schema=public
```

Notas:

- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` son obligatorias.
- `CORS_ORIGIN` acepta lista separada por comas para multiples dominios.
- `TRUST_PROXY=true` cuando corra detras de Nginx/Load Balancer.
- `BODY_LIMIT` controla el limite de payload JSON/urlencoded.

## Arranque en desarrollo

Desde la raiz del monorepo:

```bash
npm install
npm run db:up
npm --prefix apps/api run prisma:generate
npm --prefix apps/api run prisma:migrate -- --name init
npm --prefix apps/api run db:seed
npm --prefix apps/api run start:dev
```

API base: `http://localhost:4000/api`

## Scripts utiles

```bash
npm --prefix apps/api run start:dev
npm --prefix apps/api run build
npm --prefix apps/api run start:prod
npm --prefix apps/api run test
npm --prefix apps/api run test:e2e
npm --prefix apps/api run prisma:generate
npm --prefix apps/api run prisma:migrate -- --name <nombre>
npm --prefix apps/api run prisma:deploy
```

## Endpoints clave

Autenticacion:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Salud:

- `GET /api/health`
- `GET /api/metrics`

Otros modulos:

- Usuarios, cursos, tareas, asistencia, calificaciones, anuncios, mensajes, notificaciones y familias.

## WebSocket

Conexion: `ws://localhost:4000` con `auth: { token: <accessToken> }`

Eventos implementados:

- Cliente -> servidor: `typing:start`, `typing:stop`
- Servidor -> cliente: `messages:new`, `typing:start`, `typing:stop`

## Pruebas

```bash
npm --prefix apps/api run test -- --runInBand
npm --prefix apps/api run test:e2e -- --runInBand
```

Estado actual esperado:

- Unit tests: OK
- E2E tests: OK
- Lint: OK con baseline de warnings para deuda historica

## Produccion

1. Configura variables seguras en entorno.
2. Compila:

```bash
npm --prefix apps/api run build
```

3. Aplica migraciones:

```bash
npm --prefix apps/api run prisma:deploy
```

4. Arranca servicio:

```bash
npm --prefix apps/api run start:prod
```

## Observabilidad

- `GET /api/health` incluye `status`, `service`, `version`, `environment`, `uptimeSeconds` y `timestamp`.
- `GET /api/metrics` expone métricas Prometheus para integración con Grafana/Prometheus.
- Cada request queda registrada con log JSON, duracion, status y `x-request-id`.

## Docker

Desde la raiz del monorepo:

```bash
npm run docker:prod:build
npm run docker:prod:up
docker compose -f docker-compose.prod.yml exec api npm --prefix apps/api run prisma:deploy
```

Para apagar el stack:

```bash
npm run docker:prod:down
```

Checklist minima:

- JWT secrets fuertes y rotables
- CORS restringido a dominios reales
- Helmet habilitado para cabeceras de seguridad
- `TRUST_PROXY` correctamente configurado segun infraestructura
- HTTPS en proxy inverso
- Backups de base de datos
