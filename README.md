# Plataforma Escolar - Monorepo

Base inicial de una plataforma escolar con:

- Frontend: Next.js (`apps/web`)
- Backend API: NestJS (`apps/api`)
- Base de datos: PostgreSQL (Docker Compose)
- Autenticacion: JWT (access + refresh) con RBAC (`ADMIN`, `TEACHER`, `STUDENT`)

## Requisitos

- Node.js 20+
- npm 10+
- Docker Desktop

## Arranque rapido

1. Instalar dependencias en raiz:

```bash
npm install
```

2. Levantar PostgreSQL:

```bash
npm run db:up
```

3. Configurar variables de entorno API:

```bash
copy apps\\api\\.env.example apps\\api\\.env
```

4. Generar cliente Prisma y crear migracion inicial:

```bash
npm --prefix apps/api run prisma:generate
npm --prefix apps/api run prisma:migrate -- --name init
```

5. Seed del usuario admin inicial:

```bash
npm --prefix apps/api run db:seed
```

6. Levantar frontend y backend en paralelo:

```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/api
- Health: http://localhost:4000/api/health

## Credenciales seed

- Email: `admin@school.local`
- Password: `Admin123!`

## Endpoints iniciales

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET|POST /api/users` (solo ADMIN)
- `GET|POST /api/courses`
- `POST /api/courses/enrollments`
- `GET|POST /api/assignments`
- `POST /api/assignments/:id/submissions`
- `GET|POST /api/grades`
- `GET|POST /api/attendance`
- `GET|POST /api/announcements`

## Scripts utiles

- `npm run dev` - frontend + backend
- `npm run dev:web` - solo Next.js
- `npm run dev:api` - solo NestJS
- `npm run build` - build completo
- `npm run db:up` - levantar PostgreSQL
- `npm run db:down` - bajar contenedores
