# Guia de Usuario - Plataforma Escolar

Guia practica para uso diario de la plataforma escolar por rol.

## Acceso a la plataforma

1. Abre la aplicacion en http://localhost:3000.
2. Inicia sesion con tu correo y contrasena.
3. Si eres ADMIN en entorno local, puedes usar:
   - Email: admin@school.local
   - Password: Admin123!

Nota de seguridad:

- Estas credenciales son de ejemplo para pruebas locales.
- No deben usarse en entornos reales.
- En despliegues, crea usuarios y contrasenas nuevas.

## Roles disponibles

- ADMIN: administra usuarios, cursos y configuracion general.
- TEACHER: gestiona cursos, tareas, asistencia, calificaciones y anuncios.
- STUDENT: consulta cursos, entrega tareas, revisa notas y participa en mensajeria.
- FAMILY: sigue progreso, asistencia, tareas y notificaciones del estudiante vinculado.

## Flujo por rol

## ADMIN

### Gestion de usuarios

1. Entra al dashboard.
2. Ve a Usuarios.
3. Crea, edita o elimina cuentas.
4. Asigna rol correcto (ADMIN, TEACHER, STUDENT, FAMILY).

### Gestion de cursos

1. Ve a Cursos.
2. Crea curso con codigo, titulo y docente.
3. Matricula estudiantes al curso.

## TEACHER

### Publicar anuncios

1. Ve a Anuncios.
2. Crea anuncio para curso especifico o audiencia general.
3. Publica y verifica que estudiantes/familias lo reciban.

### Crear tareas

1. Ve a Tareas.
2. Crea tarea con fecha limite.
3. Define modalidad:
   - PLATFORM: respuesta en la plataforma.
   - FILE_UPLOAD: entrega por archivo.
4. Opcional: activa modo seguro y duracion cuando aplique.

### Registrar asistencia

1. Ve a Asistencia del curso.
2. Marca estado por estudiante: PRESENT, ABSENT o LATE.
3. Revisa justificantes enviados y aprueba/rechaza.

### Calificar entregas

1. Abre tarea con entregas.
2. Revisa contenido o archivo adjunto.
3. Asigna puntuacion y comentario.
4. Guarda calificacion.

## STUDENT

### Ver cursos y tareas

1. Entra al dashboard.
2. Selecciona curso.
3. Revisa tareas activas y fecha limite.

### Entregar tareas

1. Abre tarea.
2. Si es PLATFORM, escribe respuesta.
3. Si es FILE_UPLOAD, sube archivo.
4. Confirma envio.

### Revisar notas y asistencia

1. Entra a la seccion de Calificaciones para ver notas.
2. Entra a Asistencia para revisar registros.

## FAMILY

### Seguimiento del estudiante

1. Entra al dashboard de familia.
2. Consulta resumen de:
   - Asistencia
   - Tareas
   - Entregas
   - Calificaciones
   - Notificaciones

### Comunicacion con docentes

1. Abre Mensajeria.
2. Selecciona docente disponible.
3. Envia mensaje y revisa respuestas en tiempo real.

## Mensajeria en tiempo real

- La mensajeria usa Socket.IO.
- Se actualiza automaticamente en conversaciones permitidas por rol.
- Incluye estado de escritura (typing:start, typing:stop).

## Notificaciones

- Las notificaciones aparecen en el centro de notificaciones.
- Puedes marcar notificaciones como leidas.

## Problemas comunes

### No puedo iniciar sesion

- Verifica correo y contrasena.
- Si es entorno local, confirma que backend este activo en http://localhost:4000/api.

### No veo datos en dashboard

- Confirma que tu usuario tenga rol asignado correctamente.
- Verifica que existan cursos/matriculas para tu usuario.

### No puedo enviar mensajes

- Solo se permiten conversaciones entre pares vinculados segun reglas de negocio.
- Ejemplo: docente-estudiante, docente-familia, familia-docente.

### Error al entregar tarea

- Revisa modalidad de entrega.
- Verifica fecha limite y campos requeridos.

## Buenas practicas operativas

- Usa contrasenas robustas por usuario.
- Revisa notificaciones al inicio de cada jornada.
- Docentes: registra asistencia y calificaciones el mismo dia.
- Admin: audita usuarios y cursos de forma semanal.

## Soporte interno

Si necesitas soporte tecnico:

1. Captura pantalla del error.
2. Indica hora aproximada y modulo afectado.
3. Comparte pasos para reproducir el problema.