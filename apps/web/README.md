# Web - Plataforma Escolar

Frontend Next.js de la plataforma escolar.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Socket.IO client

## Requisitos

- Node.js 20+
- npm 10+
- API backend activa en `http://localhost:4000/api` o URL equivalente

## Variables de entorno

Copia `apps/web/.env.local.example` a `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Arranque en desarrollo

Desde la raiz del monorepo:

```bash
npm install
npm --prefix apps/web run dev
```

Aplicacion: `http://localhost:3000`

## Scripts utiles

```bash
npm --prefix apps/web run dev
npm --prefix apps/web run build
npm --prefix apps/web run start
npm --prefix apps/web run lint
```

## Flujos principales

- Login con credenciales seed y almacenamiento de sesion local
- Dashboard por rol: `ADMIN`, `TEACHER`, `STUDENT`, `FAMILY`
- Gestion de usuarios, cursos, tareas, asistencia y calificaciones
- Mensajeria en tiempo real con Socket.IO
- Centro de notificaciones
- Reportes/exportaciones (XLSX y PDF)

## Integracion con API

- Cliente base en `src/lib/api.ts`
- Refresh automatico de token ante `401` con `POST /auth/refresh`
- Uso de `Authorization: Bearer <accessToken>`

## Build de produccion

```bash
npm --prefix apps/web run build
npm --prefix apps/web run start
```

Notas:

- Verifica que `NEXT_PUBLIC_API_URL` apunte al backend de produccion.
- Si usas proxy inverso, enruta `/api/*` y `/socket.io/*` hacia la API.

## Estado de pruebas

Actualmente no hay suite automatizada de tests frontend en este paquete.

Recomendacion minima antes de release:

- Tests de smoke para login, dashboard y mensajeria
- Flujo de regresion por rol
