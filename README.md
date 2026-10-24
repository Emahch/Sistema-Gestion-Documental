# Sistema de Gestión Documental

Aplicación web para la gestión de documentos (.txt, .md) con explorador, papelera, compartición, actividad, reportes administrativos y vista previa.

## Tecnologías

- **Frontend:** Angular 21, PrimeNG 21, TypeScript
- **Backend:** Express, Mongoose, TypeScript
- **Base de datos:** MongoDB 7 (replica set `rs0` para transacciones)
- **Almacenamiento:** GridFS (`fs.files`/`fs.chunks`) para contenido de archivos

## Requisitos

- Docker y Docker Compose
- Node.js 20+ (solo para desarrollo local fuera de Docker)

## Arranque con Docker

```bash
docker compose up --build
```

Servicios:
- API: http://localhost:3000
- Documentación Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health
- Cliente (Angular dev): http://localhost:4200
- MongoDB: localhost:27017

## Configuración

Las variables están en `.env`. Datos relevantes:
- `MONGO_URI` con replica set (`rs0`) para habilitar transacciones
- `JWT_SECRET`, `JWT_EXPIRES_IN=8h`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` para el seed

## Datos de prueba (mínimos)

Para dejar la BD con datos mínimos para probar el sistema completo:

```bash
docker compose exec api npm run db:reset
docker compose exec api npm run db:seed-minimal
```

Credenciales (todos los usuarios creados por el seed):
- `admin@docsdrive.local` / `Admin123*` (administrador, cuota ilimitada)
- `juan@docsdrive.local` / `User123*` (usuario, cuota 100 MB)
- `maria@docsdrive.local` / `User123*` (usuario, cuota ilimitada)
- `carlos@docsdrive.local` / `User123*` (usuario, cuota 50 KB)

Contenido generado: carpetas, archivos `.txt/.md` en GridFS, un share manual (Juan → María sobre `README.md` con permiso lectura) y logs de actividad para reportes/historial.

## Usuario administrador inicial

```bash
docker compose exec api npm run db:seed-admin
```

Credenciales por defecto (desarrollo): `admin@docsdrive.local` / `Admin123*`

## Scripts útiles

En `api/`:

```bash
npm run dev                # Desarrollo con nodemon
npm run typecheck          # Verificación TypeScript
npm run db:indexes         # Garantizar índices
npm run db:diagram         # Generar docs/erd.md
npm run db:seed-admin      # Crear/asegurar administrador
npm run db:seed-minimal    # Datos mínimos para pruebas
npm run db:reset           # Limpiar toda la base de datos
npm run db:cleanup-gridfs  # Limpiar objetos huérfanos de GridFS
```

## Funcionalidades principales

- Autenticación y gestión de usuarios (solo admin)
- Explorador unificado carpetas/archivos con permisos heredados
- Subida/edición/renombrado/movimiento con validación UTF-8 y `.txt/.md`
- Papelera con restauración por grupo o por ítem y borrado definitivo
- Compartir archivos/carpetas (directo), "Compartidos por mí" y "Compartidos conmigo"
- Historial de actividad con visibilidad según rol/propiedad
- Búsqueda unificada y filtros por tipo/fecha
- Vista previa inline para TXT/MD (sin registrar actividad)
- Reportes administrativos con agregaciones MongoDB

## Documentación

- Decisiones técnicas: [docs/decisions.md](docs/decisions.md)
- Esquema/índices: [docs/erd.md](docs/erd.md)
- Planificación: ver archivo local indicado en el proyecto

## Notas

- Las transacciones requieren replica set. El entorno Docker ya lo configura.
- GridFS no participa en transacciones: metadata y contenido se manejan por separado.
- Los reportes son exclusivos de administradores y usan solo metadatos.
