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
- `GET /api/users/search?q=` autocompleta el email al compartir: exige 2 caracteres, devuelve hasta 10 usuarios activos (solo id y email) y excluye al usuario autenticado.
- Sesión del frontend en `localStorage`; el interceptor cierra sesión solo ante 401 que no sea del login.

### Archivos

- Solo `.txt` y `.md` (categoría `TXT`/`MD` derivada de la extensión); MIME en conjunto permitido; contenido validado como UTF-8 válido por fragmentos durante el streaming.
- Subir = un archivo por petición; extensión y MIME se validan **antes** de crear el objeto GridFS para no dejar huérfanos.
- Reserva de cuota al final de la transmisión. 413 si no cabe, sin consumir nada.
- Editar contenido crea siempre un objeto GridFS **nuevo**; el anterior se borra tras el commit. Si la edición crece, se reserva solo el delta.
- Renombrar conserva extensión y lo puede hacer el dueño o un usuario con permiso `edit`; duplicados -> 409.
- Reemplazar contenido acepta `.txt`/`.md` UTF-8 y exige que la extensión coincida con la del archivo actual; si no coincide -> 400 sin tocar la versión anterior.
- Mover lo puede hacer el dueño o un usuario con permiso `edit`, siempre dentro del mismo `ownerId`; el destino exige permiso `edit`; duplicados -> 409.
- `GET /api/folders/move-destinations?resourceType=&resourceId=` devuelve las carpetas del mismo propietario sobre las que el actor tiene `owner`/`edit`; al mover una carpeta excluye la propia carpeta y todo su subárbol.
- Descarga con `Content-Disposition: attachment`. Log `DOWNLOAD` (errores con `GRIDFS_READ_FAILED`).
- Vista previa `GET /api/files/:id/preview`: solo TXT/MD, stream inline (`Content-Disposition: inline`) con `charset=utf-8`. No registra ningún log de actividad, por lo que no existe la acción `VIEW`.

### Carpetas y explorador

- Vista unificada carpetas+archivos con DataView lista/cuadrícula. El marcado vive en el componente reutilizable `app-drive-view` (lo usan el explorador, "Compartidos por mí", "Compartidos conmigo" y la papelera).
- Mover usa `GET /api/folders/move-destinations`, que excluye la carpeta y su subárbol; el backend igual valida ciclos.
- En una carpeta compartida con `edit` se permite crear subcarpetas y subir archivos; las acciones de renombrar, mover y reemplazar se muestran según el permiso efectivo devuelto en cada archivo/carpeta.
- Papelera de carpetas: `DELETE /api/folders/:id` marca `isDeleted` + `deletionId` compartido a todo el subárbol (`isDeletionRoot` solo en lo pedido directamente), un log TRASH por recurso, sin liberar cuota; bloquea la raíz y subárboles con archivos ajenos.

### Papelera

- `GET /api/trash` lista solo las raíces de eliminación del usuario (carpetas o archivos) con el grupo agrupado: `itemCount` (carpetas + archivos), `sizeBytes` y la carpeta de origen. Orden por fecha de eliminación.
- `GET /api/trash/:id/contents` permite navegar dentro de una carpeta eliminada (de cualquier nivel, no solo la raíz): devuelve subcarpetas y archivos directos con `sizeBytes` e `itemCount` del subárbol de cada uno. Solo el propietario.
- `DELETE /api/files/:id` envía un archivo suelto a la papelera (solo su propietario); la cuota no se libera al tirar ni al restaurar.
- `PATCH /api/trash/:id/restore` restaura el grupo completo (carpeta con subárbol y archivos, o archivo suelto). Body opcional `{ destinationId }`: sin destino vuelve a su ubicación original; si el padre ya no existe o está eliminado -> 400 y la UI pide elegir carpeta.
- `PATCH /api/trash/:id/restore-item` restaura un archivo o una subcarpeta concreta de un grupo eliminado. `destinationId` es obligatorio (400 si falta); si el ítem es una carpeta, se restaura su subárbol completo.
- Restaurar con destino recalcula `ancestors` de la carpeta y de sus descendientes y exige destino existente, no eliminado, del mismo propietario y con permiso `edit`.
- Antes de restaurar se valida que el nombre no esté ocupado en el destino -> 409; id inválido -> 400, ausente de la papelera -> 404, ajeno -> 403. Cada recurso restaurado genera un log `RESTORE` con `{ deletionId, previousFolderId, destinationFolderId }`.
- La UI de papelera permite entrar en una carpeta eliminada, volver con la miga de pan y restaurar ítems sueltos eligiendo destino con un `p-select` alimentado por `FolderTreeService` (árbol de carpetas propias, sin la papelera).
- `FolderTreeService.options({ includeRoot, skipIds, hideIds })` centraliza el árbol de destinos: `skipIds` no lista ni recorre, `hideIds` no lista pero sí recorre; lo usa restaurar. Mover carpeta/archivo usa `GET /api/folders/move-destinations` porque también debe listar destinos accesibles por shares.
- `DELETE /api/trash/:id` elimina definitivamente el grupo completo (`deletionId`), solo el propietario. En una transacción borra metadata de carpetas y archivos, elimina sus shares y libera la cuota de cada `file.ownerId`; después del commit borra el contenido GridFS. Los logs se conservan.
- Cada recurso borrado genera un log `DELETE_PERMANENT`: las carpetas con `details { deletionId }` y los archivos con `{ deletionId, gridFsId, size }`. Si falla el borrado en GridFS se registra otro log con `status:"error"` y `errorCode:"GRIDFS_DELETE_FAILED"`.
- El borrado definitivo es por grupo; en la UI solo se ofrece sobre las raíces de la papelera (con confirmación), no sobre ítems sueltos dentro de una carpeta eliminada.
- Los permisos no se tocan al tirar ni al restaurar; el recurso conserva sus compartidos hasta el borrado definitivo, que elimina los shares.

### Compartidos (shares)

- `shares` es la fuente de verdad del acceso. El permiso efectivo se calcula en `permission.service.ts`: dueño > share directo > heredado por `ancestors`; el admin no tiene acceso por rol.
- El destinatario se identifica por `sharedWithId` (el email es mutable y no sirve como clave).
- Compartir, cambiar permiso y retirar son exclusivos del propietario; la carpeta raíz no se comparte.
- `GET /api/shares/resource?resourceType&resourceId` lista los permisos directos de un recurso (solo el propietario) y alimenta el diálogo de permisos.
- En el frontend "Compartir" se fusionó en "Administrar permisos": un solo diálogo lista permisos, añade usuarios, cambia lectura/edición y retira acceso.
- "Compartidos por mí" agrupa por recurso (una tarjeta por carpeta/archivo con sus compartidos) y reutiliza la vista del explorador; "Compartidos conmigo" usa la misma vista, una entrada por recurso compartido (propietario y permiso en el subtítulo).
- En "Compartidos por mí" el dueño puede abrir/descargar, renombrar, mover, reemplazar contenido (archivos), administrar permisos y enviar a la papelera. En "Compartidos conmigo" un permiso `edit` habilita renombrar, mover y reemplazar; administrar permisos y enviar a la papelera siguen reservados al propietario.
- Eliminar (papelera) nunca lo puede hacer un receptor, ni siquiera con `edit`: la papelera, la cuota y la restauración son del propietario.


## Vista previa

- El componente reutilizable `app-file-preview-dialog` carga el contenido con `FolderService.previewFile()` (respuesta de texto) y lo muestra en un `<pre>` con scroll; Angular escapa el contenido automáticamente.
- La vista previa está disponible para archivos en el explorador y en "Compartidos"; respeta el permiso efectivo de lectura.
- Abrir o cerrar la vista previa no genera actividad: el endpoint de preview no crea `ActivityLog`, a diferencia de la descarga.
- El nombre del archivo se envía en `Content-Disposition` con fallback ASCII y `filename*` UTF-8 para nombres con acentos.

## Búsqueda y filtros

- `GET /api/search?q=&scope=own|shared|all&page=&limit=` busca de forma unificada carpetas y archivos por `nameNormalized` con regex escapado (case-insensitive). Exige `q` no vacío.
- El alcance `shared` incluye shares directos y la herencia por `ancestors`: una carpeta compartida hace visibles sus subcarpetas y los archivos contenidos. `resolveVisibility` calcula una sola vez los ids compartidos y los reutiliza.
- Los resultados se fusionan en Node (carpetas + archivos), se ordenan por nombre y se paginan de forma combinada.
- Cada resultado incluye el permiso efectivo (`owner`/`edit`/`read`) para que la UI muestre solo acciones válidas.
- `GET /api/files/filter?category=TXT|MD&from=&to=&scope=&page=&limit=` filtra solo archivos por categoría y rango de `createdAt` (extremos inclusivos), orden descendente por fecha de creación y con el mismo alcance own/shared/all.
- `from` y `to` se interpretan como fechas ISO; la UI envía el inicio y el fin del día local seleccionado. `from > to` -> 400.
- Los índices existentes (`ownerId,isDeleted,nameNormalized`/`parentId,isDeleted,nameNormalized` y equivalentes de archivos) cubren el prefijo de igualdad; el regex no usa índice, igual que en la búsqueda por nombre.
