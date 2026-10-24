# Sistema de Gestión Documental

Aplicación web para la gestión de documentos (.txt, .md) con explorador, papelera, compartición, actividad, reportes administrativos y vista previa.

## Tecnologías

- **Frontend:** Angular 21, PrimeNG 21, TypeScript
- **Backend:** Express, Mongoose, TypeScript
- **Base de datos:** MongoDB 7 (replica set `rs0` para transacciones)
- **Almacenamiento:** GridFS (`fs.files`/`fs.chunks`) para contenido de archivos

## Requisitos

- Opción A (con contenedores): Docker Desktop + Docker Compose
- Opción B (sin Docker):
  - Node.js 22 (la misma versión que usan los Dockerfile) y npm
  - MongoDB Server 7 y MongoDB Shell (`mongosh`), ambos disponibles en el `PATH`
  - Windows: PowerShell 5.1 o superior. Linux/macOS: bash

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

Esta opción corre MongoDB, API y cliente directamente. Reproduce la misma configuración que Docker: MongoDB con **autenticación, keyfile y replica set `rs0`** (necesario para transacciones).

Se usan 4 terminales:

| # | Qué | Dónde |
|---|-----|-------|
| 1 | MongoDB (segundo plano) | raíz del proyecto |
| 2 | Generar `api/.env` + seed | raíz y `api/` |
| 3 | API | `api/` |
| 4 | Cliente | `client/` |

### 1) Generar `api/.env`

La API lee su configuración desde `api/.env`. El script lo genera a partir del `.env` de la raíz (el mismo que usa Docker). Si no existe, usa `.env.example`, y si tampoco, valores por defecto.

Linux / macOS:

```bash
bash scripts/setup-env.sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-env.ps1
```

- No sobrescribe un `api/.env` existente. Para regenerarlo usa `--force` (bash) o `-Force` (PowerShell).
- La única diferencia con Docker es el host de MongoDB: en Docker es `mongo`, en local es `127.0.0.1`.
- El cliente Angular **no usa `.env`**, por eso no se genera ningún archivo para él.

Resultado esperado (`api/.env`):

```dotenv
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:4200
MONGO_URI=mongodb://admin:admin123@127.0.0.1:27017/gestion_documental?authSource=admin&replicaSet=rs0&directConnection=true
JWT_SECRET=dev-secret-cambiar-en-produccion
JWT_EXPIRES_IN=8h
ADMIN_EMAIL=admin@docsdrive.local
ADMIN_PASSWORD=Admin123*
```

> Si tu contraseña de Mongo tiene caracteres especiales (`@`, `/`, `:`, `%`), el script los codifica automáticamente en la URI.

### 2) Iniciar MongoDB (auth + keyfile + replica set)

Linux / macOS:

```bash
bash scripts/local-mongo.sh start
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local-mongo.ps1 start
```

Las credenciales, el puerto y el nombre del replica set salen de `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `MONGO_PORT` y `MONGO_REPLICA_SET` del `.env` de la raíz.

Qué hace el script (igual que `mongo` + `mongo-init` en `docker-compose.yml`):

1. **Primer arranque únicamente:** inicia `mongod` sin auth ni replica set, crea el usuario `root` y lo apaga.
2. Genera un keyfile (una sola vez) en `mongo-data/local-auth/keyfile`.
3. Inicia `mongod` en segundo plano con `--replSet rs0 --keyFile ... --bind_ip 127.0.0.1`.
4. Ejecuta `rs.initiate(...)` con el host `127.0.0.1:27017` y espera a que el nodo sea PRIMARY.

Es idempotente: si ya está corriendo no hace nada, y en los siguientes arranques solo ejecuta los pasos 3 y 4.

Otros comandos (mismo script, mismos argumentos en `.sh` y `.ps1`):

```bash
bash scripts/local-mongo.sh status   # ¿está corriendo? ¿replica set ok?
bash scripts/local-mongo.sh stop     # Detener MongoDB
bash scripts/local-mongo.sh reset    # BORRA todos los datos locales (pide confirmación)
```

Datos y logs quedan en `mongo-data/local-auth/` (`db/`, `keyfile`, `mongod.log`).

<details>
<summary>Equivalente manual (lo que automatiza el script)</summary>

Primer arranque, sin auth, solo para crear el usuario:

```bash
mkdir -p mongo-data/local-auth/db
mongod --dbpath mongo-data/local-auth/db --port 27017 --bind_ip 127.0.0.1
```

En otra terminal:

```bash
mongosh --port 27017 --eval "db.getSiblingDB('admin').createUser({user:'admin', pwd:'admin123', roles:['root']})"
mongosh --port 27017 --eval "db.getSiblingDB('admin').shutdownServer()"
```

Generar el keyfile (Linux/macOS; en Windows genera 756 bytes aleatorios en base64 con PowerShell):

```bash
head -c 756 /dev/urandom | base64 | tr -d '\n' > mongo-data/local-auth/keyfile
chmod 400 mongo-data/local-auth/keyfile
```

Arranque definitivo con replica set y keyfile:

```bash
mongod --dbpath mongo-data/local-auth/db --port 27017 --bind_ip 127.0.0.1 \
  --replSet rs0 --keyFile mongo-data/local-auth/keyfile
```

Inicializar el replica set (una sola vez):

```bash
mongosh --port 27017 -u admin -p admin123 --authenticationDatabase admin \
  --eval "rs.initiate({_id:'rs0', members:[{_id:0, host:'127.0.0.1:27017'}]})"
```

Verificar:

```bash
mongosh --port 27017 -u admin -p admin123 --authenticationDatabase admin --eval "rs.status().ok"
```

</details>

### 3) Instalar la API y crear datos iniciales

Desde `api/`, con MongoDB ya corriendo y `api/.env` generado:

```bash
cd api
npm install
npm run db:seed-admin      # Crea/asegura el administrador (usa ADMIN_EMAIL y ADMIN_PASSWORD)
```

Opcionalmente, datos mínimos de prueba (ver sección [Datos de prueba](#datos-de-prueba-mínimos)):

```bash
npm run db:seed-minimal
```

### 4) Iniciar la API

En la misma terminal (`api/`):

```bash
npm run dev
```

Arranca con nodemon en http://localhost:3000.

### 5) Iniciar el cliente

En otra terminal:

```bash
cd client
npm install
npm start
```

Abre http://localhost:4200.

### Orden de inicio (resumen)

1. `setup-env` → genera `api/.env`
2. `local-mongo start` → MongoDB con replica set
3. `cd api && npm install && npm run db:seed-admin`
4. `cd api && npm run dev`
5. `cd client && npm install && npm start`

Para apagar: `Ctrl+C` en API y cliente, y luego `local-mongo stop`.

### Seeds y comandos de base de datos

Ejecuta estos comandos desde `api/` (con MongoDB corriendo y `api/.env` generado):

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

### URLs locales

- API: http://localhost:3000
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health
- Cliente: http://localhost:4200

### Problemas comunes (sin Docker)

| Síntoma | Causa y solución |
|---------|------------------|
| `'mongod' no está en el PATH` | Instala MongoDB Server 7 y `mongosh`, y reabre la terminal. |
| `Hay un mongod en el puerto 27017 que no fue iniciado por este script` | Otro MongoDB usa el puerto (en Windows suele ser el servicio `MongoDB`). Detenlo o cambia `MONGO_PORT` en el `.env` de la raíz y regenera con `setup-env --force`. |
| `Authentication failed` | El usuario root se crea solo la primera vez. Si cambiaste `MONGO_ROOT_USER` o `MONGO_ROOT_PASSWORD` después, ejecuta `local-mongo reset` y vuelve a iniciar. |
| `not primary` / `NotWritablePrimary` | El replica set no se inicializó o aún no es PRIMARY. Ejecuta `local-mongo status` y revisa `mongo-data/local-auth/mongod.log`. |
| `Server selection timed out` | Verifica que `api/.env` use `127.0.0.1` y el mismo puerto/replica set que MongoDB. |
| Error de CORS entre cliente y API | `CLIENT_URL` en `api/.env` debe coincidir con la URL del cliente (`http://localhost:4200`). |
| `EADDRINUSE` (puerto 3000 o 4200 ocupado) | Cierra el proceso que usa el puerto o cambia `API_PORT`/`CLIENT_PORT` y regenera `api/.env`. |

> Si venías usando una versión anterior del inicio local, sus datos estaban en `mongo-data/local/` (sin autenticación). No son compatibles con este flujo; puedes borrar esa carpeta.

## Configuración

- **Docker:** todas las variables están en el único `.env` de la raíz del proyecto; Docker las distribuye a MongoDB, API y cliente.
- **Local (sin Docker):** el mismo `.env` de la raíz es la fuente de valores. `scripts/setup-env.*` genera `api/.env` a partir de él (cambiando el host de MongoDB a `127.0.0.1`) y `scripts/local-mongo.*` toma de él las credenciales y el puerto de MongoDB.

Datos relevantes:
- `MONGO_URI` con replica set (`rs0`) para habilitar transacciones
- `JWT_SECRET`, `JWT_EXPIRES_IN=8h`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` para el seed

El `.env` y `api/.env` no deben subirse al repositorio; la plantilla versionada es [.env.example](.env.example).

## Datos de prueba (mínimos)

Para dejar la BD con datos mínimos para probar el sistema completo:

Con Docker:

```bash
docker compose exec api npm run db:reset
docker compose exec api npm run db:seed-minimal
```

Sin Docker (desde `api/`):

```bash
npm run db:reset
npm run db:seed-minimal
```

Credenciales (todos los usuarios creados por el seed):
- `admin@docsdrive.local` / `Admin123*` (administrador, cuota ilimitada)
- `juan@docsdrive.local` / `User123*` (usuario, cuota 100 MB)
- `maria@docsdrive.local` / `User123*` (usuario, cuota ilimitada)
- `carlos@docsdrive.local` / `User123*` (usuario, cuota 50 KB)

Contenido generado: carpetas, archivos `.txt/.md` en GridFS, un share manual (Juan → María sobre `README.md` con permiso lectura) y logs de actividad para reportes/historial.

## Usuario administrador inicial

Con Docker:

```bash
docker compose exec api npm run db:seed-admin
```

Sin Docker (desde `api/`):

```bash
npm run db:seed-admin
```

Credenciales por defecto (desarrollo): `admin@docsdrive.local` / `Admin123*`

## Scripts útiles

En la raíz del proyecto (`scripts/`):

| Script | Para qué |
|--------|----------|
| `run-docker.ps1` | Levanta el stack Docker (valida el `.env` de la raíz y lo pasa a Compose) |
| `setup-env.sh` / `setup-env.ps1` | Genera `api/.env` para ejecución sin Docker |
| `local-mongo.sh` / `local-mongo.ps1` | MongoDB local con auth + keyfile + replica set (`start`, `stop`, `status`, `reset`) |

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

## Notas

- Las transacciones requieren replica set. El entorno Docker y los scripts de ejecución local ya lo configuran.
- GridFS no participa en transacciones: metadata y contenido se manejan por separado.
- Los reportes son exclusivos de administradores y usan solo metadatos.