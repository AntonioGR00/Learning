# Release Checklist

Checklist operativo para preparar un cambio antes de merge y despliegue.

## Orden recomendado de commits

1. `feat(api): add auth logout and strict jwt env validation`
2. `test(api): align app tests with health endpoint`
3. `chore(api): harden bootstrap with helmet cors and body limits`
4. `ci: add github actions validation pipeline`
5. `docs: update monorepo api and web readmes`

Si el cambio sale en una sola PR, mantener al menos esta separacion logica aunque finalmente se compacte en menos commits.

## Checklist antes de PR

- Build local OK
- Tests unitarios OK
- Tests e2e OK
- Variables de entorno nuevas documentadas
- README actualizado si cambia comportamiento operativo
- Sin cambios de formato no relacionados
- Diff revisable por funcionalidad

## Checklist antes de merge

- CI verde en etapas bloqueantes
- Validado impacto en auth, CORS y arranque
- Revisado uso de secretos obligatorios
- Confirmado que no se introducen credenciales reales

## Checklist antes de deploy

- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` definidos en entorno
- `CORS_ORIGIN` configurado con dominios reales
- `TRUST_PROXY=true` si hay proxy inverso o balanceador
- `BODY_LIMIT` revisado segun payload esperado
- Migraciones Prisma listas para ejecutar
- Plan de rollback definido

## Titulo sugerido de PR

`Release hardening: auth consistency, CI, docs and API security baseline`

## Descripcion sugerida de PR

### Objetivo

Dejar la base del monorepo lista para release con mejoras de seguridad, consistencia de autenticacion, documentacion operativa y validacion automatizada.

### Cambios incluidos

- Se agrega `POST /api/auth/logout`
- Se eliminan fallbacks inseguros de secretos JWT
- Se endurece bootstrap API con Helmet, CORS configurable y limites de payload
- Se corrigen tests del health endpoint
- Se agrega pipeline de GitHub Actions
- Se actualiza documentacion del monorepo, API y Web

### Validacion realizada

- `npm --prefix apps/api run test -- --runInBand`
- `npm --prefix apps/api run test:e2e -- --runInBand`
- `npm --prefix apps/api run build`
- `npm run build`

### Riesgos conocidos

- Lint sigue con deuda tecnica previa y hoy permanece como job no bloqueante en CI.