# Sistema de Gestión Documental

Aplicación web para la gestión de documentos (.txt, .md) con explorador, papelera, compartición, actividad, reportes administrativos y vista previa.

## Tecnologías

- **Frontend:** Angular 21, PrimeNG 21, TypeScript
- **Backend:** Express, Mongoose, TypeScript
- **Base de datos:** MongoDB 7 (replica set `rs0` para transacciones)
- **Almacenamiento:** GridFS (`fs.files`/`fs.chunks`) para contenido de archivos

## Requisitos

- Opción A (con contenedores): Docker Desktop + Docker Compose
- Opción B (sin Docker): Node.js 20+ y MongoDB 7+

## Inicio rápido (con Docker)

### 1) Levantar servicios

Opción directa:

```bash
docker compose up --build -d
```

Opción con script (Windows PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-docker.ps1
```

### 2) Verificar estado

```bash
docker compose ps
```

Servicios:
- API: http://localhost:3000
- Documentación Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health
- Cliente (Angular dev): http://localhost:4200
- MongoDB: localhost:27017

### 3) Detener servicios

```bash
docker compose down
```

Para borrar volúmenes de datos:

```bash
docker compose down -v
```

### 4) Si Docker no abre en PowerShell

Si aparece "docker no se reconoce", instala Docker Desktop y reinicia terminal/Windows.

## Ejecución local (sin Docker)

> Esta opción corre API + cliente en tu máquina local.

El script local crea `api/.env` si todavía no existe. No usa ni modifica el archivo de entorno externo de Docker.

No sobrescribe `api/.env`. También crea `mongo-data/local/` para los datos de MongoDB local. La plantilla versionada está en [.env.example](.env.example).

### 1) Iniciar MongoDB local

La API usa transacciones en varias operaciones. Para comportamiento completo, ejecuta MongoDB con replica set `rs0`.

### Opción automática

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-local.ps1 -Install
```

El script verifica `mongod` y `mongosh`, inicia MongoDB en `mongo-data/local`, espera a que responda, inicializa el replica set y abre API y cliente en terminales separadas.

Si MongoDB ya está ejecutándose en `127.0.0.1:27017`, reutiliza ese proceso y solo intenta inicializar el replica set.

### Opción manual: base de datos y replica set

Abre una terminal y ejecuta MongoDB:

```powershell
New-Item -ItemType Directory -Force .\mongo-data\local
mongod --dbpath .\mongo-data\local --port 27017 --replSet rs0 --bind_ip 127.0.0.1
```

Deja esa terminal abierta. En otra terminal, inicializa el replica set una sola vez:

```bash
mongosh --host 127.0.0.1 --port 27017 --eval "try { rs.status() } catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]}) }"
```

Comprueba el estado:

```bash
mongosh --host 127.0.0.1 --port 27017 --eval "rs.status().ok"
```

### API local

En otra terminal:

```bash
cd api
npm install
npm run dev
```

La API carga `api/.env`. Si todavía no existe, créalo copiando [.env.example](.env.example) y agrega al menos:

```dotenv
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/gestion_documental?replicaSet=rs0
JWT_SECRET=dev-secret
JWT_EXPIRES_IN=8h
ADMIN_EMAIL=admin@docsdrive.local
ADMIN_PASSWORD=Admin123*
```

### Cliente local

En otra terminal:

```bash
cd client
npm install
npm start
```

### Seeds y comandos de base de datos

Ejecuta estos comandos desde `api/`, con la API detenida o en otra terminal:

```bash
npm run db:indexes         # Garantizar índices
npm run db:seed-admin      # Crear/asegurar administrador
npm run db:seed-minimal    # Crear datos mínimos de prueba
npm run db:reset           # Borrar datos y reiniciar la base
npm run db:cleanup-gridfs  # Limpiar objetos GridFS huérfanos
npm run db:diagram         # Actualizar docs/erd.md
```

Para un entorno de prueba limpio:

```bash
npm run db:reset
npm run db:seed-minimal
```

### Inicio local con script

El script instala dependencias si faltan, prepara `api/.env`, inicia MongoDB con replica set y abre API + cliente:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-local.ps1 -Install
```

### URLs locales

- API: http://localhost:3000
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health
- Cliente: http://localhost:4200

## Configuración

Para Docker, todas las variables están en el único `.env` de la raíz del proyecto. Para ejecución local, la API usa `api/.env`; ese flujo no utiliza el `.env` de Docker. Datos relevantes:
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

En la raíz del proyecto (`scripts/`):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-docker.ps1   # Levanta stack Docker
powershell -ExecutionPolicy Bypass -File .\scripts\run-local.ps1 -Install  # Arranque local sin Docker
```

Para Docker, utiliza únicamente el archivo `.env` de la raíz del proyecto. El script `run-docker.ps1` lo valida y lo pasa explícitamente a Compose:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-docker.ps1
```

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
