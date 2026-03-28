# Plataforma Escolar - Monorepo

Plataforma escolar full-stack con:

- **Frontend**: Next.js 15 (`apps/web`)
- **Backend API**: NestJS 11 (`apps/api`)
- **Base de datos**: PostgreSQL 16 vía Docker Compose
- **Autenticación**: JWT (access + refresh) con RBAC (`ADMIN`, `TEACHER`, `STUDENT`)
- **WebSocket**: Socket.IO para mensajería en tiempo real

## Requisitos

- Node.js 20+
- npm 10+
- Docker Desktop (para PostgreSQL local)

---

## Arranque rápido (desarrollo local)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno de la API

```bash
copy apps\api\.env.example apps\api\.env   # Windows
cp apps/api/.env.example apps/api/.env     # macOS / Linux
```

Edita `apps/api/.env` con los valores reales (ver sección «Variables de entorno» más abajo).

### 3. Levantar PostgreSQL con Docker

```bash
npm run db:up
```

### 4. Ejecutar migraciones y generar cliente Prisma

```bash
npm --prefix apps/api run prisma:generate
npm --prefix apps/api run prisma:migrate -- --name init
```

### 5. Seed del usuario admin inicial

```bash
npm --prefix apps/api run db:seed
```

### 6. Iniciar frontend + backend

```bash
npm run dev
```

| Servicio   | URL                           |
|------------|-------------------------------|
| Frontend   | http://localhost:3000         |
| API REST   | http://localhost:4000/api     |
| WebSocket  | ws://localhost:4000           |

---

## Credenciales seed

| Campo    | Valor               |
|----------|---------------------|
| Email    | `admin@school.local` |
| Password | `Admin123!`         |

---

## Variables de entorno

### `apps/api/.env`

| Variable                 | Descripción                                              | Ejemplo                                                        |
|--------------------------|----------------------------------------------------------|----------------------------------------------------------------|
| `PORT`                   | Puerto de escucha del servidor NestJS                    | `4000`                                                          |
| `DATABASE_URL`           | Cadena de conexión PostgreSQL (Prisma)                   | `postgresql://postgres:postgres@localhost:5432/school_db?schema=public` |
| `JWT_ACCESS_SECRET`      | Clave secreta para firmar tokens de acceso               | `<cadena aleatoria segura, ≥32 chars>`                         |
| `JWT_REFRESH_SECRET`     | Clave secreta para firmar tokens de refresco             | `<cadena aleatoria segura, ≥32 chars>`                         |
| `JWT_ACCESS_EXPIRES_IN`  | Duración del token de acceso                             | `15m`                                                           |
| `JWT_REFRESH_EXPIRES_IN` | Duración del token de refresco                           | `7d`                                                            |

### `apps/web/.env.local` (opcional)

| Variable              | Descripción                                        | Valor por defecto               |
|-----------------------|----------------------------------------------------|---------------------------------|
| `NEXT_PUBLIC_API_URL` | URL base de la API (incluye `/api`)               | `http://localhost:4000/api`     |

---

## API — Endpoints principales

### Autenticación
| Método | Ruta                  | Descripción                        |
|--------|-----------------------|------------------------------------|
| POST   | `/api/auth/login`     | Obtener access + refresh token     |
| POST   | `/api/auth/refresh`   | Renovar access token               |
| GET    | `/api/auth/me`        | Perfil del usuario autenticado     |
| POST   | `/api/auth/logout`    | Invalidar refresh token            |

### Usuarios (solo ADMIN)
| Método | Ruta               | Descripción          |
|--------|--------------------|----------------------|
| GET    | `/api/users`       | Listar usuarios      |
| POST   | `/api/users`       | Crear usuario        |
| PATCH  | `/api/users/:id`   | Actualizar usuario   |
| DELETE | `/api/users/:id`   | Eliminar usuario     |

### Cursos
| Método | Ruta                             | Descripción                   |
|--------|----------------------------------|-------------------------------|
| GET    | `/api/courses`                   | Listar cursos                 |
| POST   | `/api/courses`                   | Crear curso (ADMIN/TEACHER)   |
| POST   | `/api/courses/enrollments`       | Matricular estudiante         |

### Tareas (Assignments)
| Método | Ruta                                     | Descripción                          |
|--------|------------------------------------------|--------------------------------------|
| GET    | `/api/assignments/course/:id`            | Tareas de un curso                   |
| POST   | `/api/assignments`                       | Crear tarea (multipart/form-data)    |
| POST   | `/api/assignments/:id/submissions`       | Entregar tarea (estudiante)          |

### Calificaciones
| Método | Ruta                        | Descripción                      |
|--------|-----------------------------|----------------------------------|
| GET    | `/api/grades/course/:id`    | Calificaciones del curso         |
| POST   | `/api/grades`               | Calificar entrega (TEACHER)      |
| PATCH  | `/api/grades/:id`           | Editar calificación              |

### Asistencia
| Método | Ruta                           | Descripción                       |
|--------|--------------------------------|-----------------------------------|
| GET    | `/api/attendance/course/:id`   | Asistencia del curso              |
| POST   | `/api/attendance`              | Registrar asistencia (TEACHER)    |

### Mensajería
| Método | Ruta                          | Descripción                                  |
|--------|-------------------------------|----------------------------------------------|
| GET    | `/api/messages/contacts`      | Contactos disponibles                        |
| GET    | `/api/messages/:userId`       | Hilo de mensajes con un usuario              |
| POST   | `/api/messages`               | Enviar mensaje (máx 30/min, máx 2000 chars) |
| POST   | `/api/messages/:userId/read`  | Marcar mensajes como leídos                  |

### WebSocket (Socket.IO)
Conectar a `ws://localhost:4000` con `auth: { token: <accessToken> }`.

| Evento (cliente → servidor) | Payload                    | Descripción                        |
|-----------------------------|----------------------------|------------------------------------|
| `typing:start`              | `{ recipientId: number }`  | Notificar que se está escribiendo  |
| `typing:stop`               | `{ recipientId: number }`  | Notificar que se dejó de escribir  |

| Evento (servidor → cliente) | Payload                    | Descripción                        |
|-----------------------------|----------------------------|------------------------------------|
| `messages:new`              | `ChatMessage`              | Nuevo mensaje recibido             |
| `typing:start`              | `{ userId: number }`       | El peer empezó a escribir          |
| `typing:stop`               | `{ userId: number }`       | El peer dejó de escribir           |

---

## Scripts útiles

| Comando                  | Descripción                            |
|--------------------------|----------------------------------------|
| `npm run dev`            | Frontend + backend en paralelo         |
| `npm run dev:web`        | Solo Next.js                           |
| `npm run dev:api`        | Solo NestJS (watch mode)               |
| `npm run build`          | Build completo para producción         |
| `npm run db:up`          | Levantar PostgreSQL vía Docker         |
| `npm run db:down`        | Detener contenedores                   |
| `npm run db:logs`        | Ver logs de PostgreSQL                 |

---

## Tests

```bash
# Unit tests
npm --prefix apps/api test

# E2E tests (requiere base de datos en TEST_DATABASE_URL)
npm --prefix apps/api run test:e2e
```

Los tests e2e cubren:
- **Mensajería REST**: autenticación, creación, lectura, mark-as-read
- **Asistencia**: CRUD y validación de estados (`PRESENT`, `ABSENT`, `LATE`)
- **Tareas con adjuntos**: upload multipart, validación de URL almacenada

---

## Guía de despliegue en producción

### Requisitos de infraestructura
- PostgreSQL 16 gestionado (Supabase, Railway, RDS, Neon…)
- Servidor Node.js o plataforma PaaS (Railway, Fly.io, Render, VPS)
- CDN/Storage para los ficheros subidos (opcional; por defecto se escribe en `apps/api/uploads/`)

### Pasos

1. **Variables de entorno de producción**  
   Configura todas las variables de `apps/api/.env` en tu plataforma. Usa secretos fuertes para `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` (nunca iguales a los de desarrollo).

2. **Build**
   ```bash
   npm run build
   ```

3. **Migraciones en producción**
   ```bash
   npm --prefix apps/api run prisma:deploy
   ```
   `prisma migrate deploy` aplica solo migraciones pendientes sin crear nuevas (seguro para CI/CD).

4. **Arrancar la API**
   ```bash
   node apps/api/dist/main.js
   ```

5. **Arrancar el frontend**  
   Despliega `apps/web/.next` mediante `next start` o exportándolo como sitio estático (`next build && next export` si no usas SSR dinámico).

6. **CORS / proxy inverso**  
   Configura Nginx o tu balanceador para redirigir:
   - `/api/*` → API Node (puerto 4000)
   - `/socket.io/*` → API Node con upgrade a WebSocket
   - `/*` → Next.js (puerto 3000)

### Seguridad en producción
- Rota los secretos JWT periódicamente.
- Activa HTTPS en el proxy inverso.
- Restringe `CORS` a los dominios autorizados cambiando `app.enableCors({ origin: ['https://tu-dominio.com'] })` en `main.ts`.
- Configura un almacenamiento externo (S3, Cloudinary…) para los adjuntos en lugar del disco local.

