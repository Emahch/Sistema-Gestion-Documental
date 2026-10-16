# Decisiones del proyecto

Esquema e índices en vivo: [erd.md](./erd.md) (generado con `npm run db:diagram`).

## Tecnologías

- Angular 21 + PrimeNG 21 (preset propio naranja/gris sobre Aura) · Express + Mongoose · MongoDB 7 replica set `rs0` single-node en dev (transacciones y change streams).
- API en TypeScript estricto con `ts-node` en desarrollo (`tsc --noEmit` como verificación).
- Auth con JWT (`jsonwebtoken`, 8h) y hash con `bcryptjs`.
- Swagger UI en `.../api/docs/`.
- Subida de archivos por streaming con `busboy`.

## Tema claro/oscuro

- El modo oscuro es manual por clase `.app-dark` en `<html>` (`darkModeSelector`), con preferencia persistida en `localStorage`.
- El CSS propio usa únicamente tokens adaptativos para el tema claro y oscuro.

## Base de datos

- Colecciones: `users`, `folders`, `files`, `shares`, `activity_logs` + GridFS (`fs.files`, `fs.chunks`).
- `users.storage` embebido (`quotaBytes`, `usedBytes`); `null` = cuota ilimitada.
- `activity_logs` usa campo `timestamp` explícito (sin `updatedAt`).
- `ensure-indexes` solo suma índices; si uno cambia hay que borrar el viejo a mano.
- El contenido de archivos vive en GridFS en trozos de 255 KB; `files` guarda solo metadatos + `gridFsId`. GridFS no participa en transacciones: la metadata va en transacción y el contenido se borra/crea fuera de ella manualmente.
- Los objetos GridFS huérfanos (fallos a mitad de subida) se borran al fallar; el script de limpieza usa `gridFsId` de los logs.

## Reglas de negocio implementadas

### Auth y usuarios

- Sin autorregistro: solo admin crea usuarios; el primero nace con `db:seed-admin`.
- Crear usuario = transacción (usuario + carpeta raíz `Mi unidad` + log `USER_CREATE`).
- Login con `emailNormalized`; 401 genérico sin distinguir causa; cada petición revalida `isActive`.
- Email duplicado -> 409. Email con formato válido exigido en crear y editar.
- Cuota inicial configurable, `null` = ilimitada.
- Ajuste de cuota (solo admin).
- Nadie puede desactivarse ni quitarse el rol a sí mismo -> 400.
- `PATCH /api/users/me` (perfil propio: email/password) y `PATCH /api/users/:id` (admin: email/rol/password).
- Reconciliación de cuota solo lectura: compara `usedBytes` con la suma real.
- Sesión del frontend en `localStorage`; el interceptor cierra sesión solo ante 401 que no sea del login.

### Archivos

- Solo `.txt` y `.md` (categoría `TXT`/`MD` derivada de la extensión); MIME en conjunto permitido; contenido validado como UTF-8 válido por fragmentos durante el streaming.
- Subir = un archivo por petición; extensión y MIME se validan **antes** de crear el objeto GridFS para no dejar huérfanos.
- Reserva de cuota al final de la transmisión. 413 si no cabe, sin consumir nada.
- Editar contenido crea siempre un objeto GridFS **nuevo**; el anterior se borra tras el commit. Si la edición crece, se reserva solo el delta.
- Renombrar conserva extensión; mover solo dentro del mismo `ownerId` y solo el dueño; duplicados -> 409.
- Descarga con `Content-Disposition: attachment`. Log `DOWNLOAD` (errores con `GRIDFS_READ_FAILED`).

### Carpetas y explorador

- Vista unificada carpetas+archivos con DataView lista/cuadrícula.
- Mover excluye en UI la carpeta, su subárbol y su carpeta padre como destino; el backend igual valida ciclos (defensa en dos capas).
- Papelera de carpetas: `DELETE /api/folders/:id` marca `isDeleted` + `deletionId` compartido a todo el subárbol (`isDeletionRoot` solo en lo pedido directamente), un log TRASH por recurso, sin liberar cuota; bloquea la raíz y subárboles con archivos ajenos.
