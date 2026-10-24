# Decisiones del proyecto

Esquema e índices en vivo: [erd.md](./erd.md) (generado con `npm run db:diagram`).

## Arquitectura

- Angular 21 + PrimeNG 21, Express + Mongoose y MongoDB 7 en un replica set single-node para habilitar transacciones.
- API en TypeScript estricto con `ts-node` en desarrollo; `tsc --noEmit` como verificación.
- Autenticación con JWT de 8 horas y contraseñas con `bcryptjs`.
- Subida de archivos por streaming con `busboy`.

## MongoDB

- Los metadatos de archivos viven en `files`; el contenido binario en GridFS (`fs.files` y `fs.chunks`). `files.gridFsId` enlaza ambos.
- GridFS no participa en transacciones. La metadata se guarda en una transacción y el contenido se crea o elimina fuera de ella; si algo falla se elimina el objeto GridFS para evitar huérfanos.
- Las operaciones que afectan varias colecciones usan transacciones: alta de usuario con su carpeta raíz y log, borrado definitivo de metadata/shares/cuota, y movimientos que deben mantener consistencia.
- La cuota se guarda embebida en `users.storage` (`quotaBytes`, `usedBytes`); `quotaBytes: null` significa ilimitada. La reserva de cuota se hace al finalizar la transmisión para no consumir espacio si la subida falla.
- `activity_logs` es un historial append-only con `timestamp` explícito. Los logs se conservan aunque el recurso se elimine definitivamente.
- Los logs guardan `resourceSnapshot` (por ejemplo el nombre) como copia denormalizada para que el historial siga siendo legible cuando el recurso ya no existe.
- Los reportes usan el pipeline de agregación:
  - `$match` para filtrar por estado, tipo, usuario o rango de fechas.
  - `$group` para contar y sumar métricas.
  - `$lookup` + `$unwind` para unir archivos y usuarios sin consultas N+1.
  - `$facet` para obtener datos paginados, total y resumen en una sola consulta.
  - `$dateTrunc` para agrupar operaciones por día, semana o mes en la zona `America/Guatemala`.
- Los índices siguen la regla de prefijo de igualdad antes del campo de orden. Los reportes aprovechan índices de `activity_logs` por fecha, acción/estado y recurso; de `files` por propietario/estado y fecha; y de `shares` por recurso/destinatario y propietario/origen/fecha.
- La búsqueda por nombre usa `nameNormalized` con regex escapado e insensible a mayúsculas. El regex no puede aprovechar el índice, pero el prefijo de igualdad (`ownerId`, `parentId`, `isDeleted`) sí.
- Los identificadores se comparan como `ObjectId`; los emails no se usan como clave porque son mutables.

## Seguridad y permisos

- No hay autorregistro: solo un administrador crea usuarios. El primer administrador se crea con `db:seed-admin`.
- Cada petición revalida que el usuario siga activo; el login devuelve un 401 genérico sin revelar la causa.
- Un usuario no puede desactivarse ni quitarse el rol de administrador a sí mismo.
- `shares` es la fuente de verdad del acceso. El permiso efectivo se calcula como dueño > share directo > heredado por `ancestors`.
- El rol de administrador no concede acceso al contenido de otros usuarios.
- Los destinatarios se identifican por `sharedWithId`, no por email.
- Compartir, cambiar permisos y retirar acceso son exclusivos del propietario; la carpeta raíz no se comparte.
- En el frontend, compartir y administrar permisos están unificados en un solo diálogo.

## Archivos, cuota y vista previa

- Solo se permiten archivos `.txt` y `.md`, con contenido UTF-8 válido y MIME permitido; la categoría se deriva de la extensión.
- La extensión y el MIME se validan antes de crear el objeto GridFS para no dejar huérfanos.
- Editar el contenido crea siempre un objeto GridFS nuevo y elimina el anterior después del commit; si el tamaño crece, solo se reserva la diferencia.
- Renombrar y mover respetan la extensión y el propietario; los nombres duplicados en el mismo destino devuelven 409.
- Mover requiere permiso `edit` en origen y destino y nunca cruza de propietario.
- Descargar envía `Content-Disposition: attachment` y registra actividad.
- La vista previa solo está disponible para TXT/MD, devuelve el contenido inline en UTF-8 y no registra actividad. No existe la acción `VIEW`.
- El nombre se envía con fallback ASCII y `filename*` UTF-8 para admitir acentos.

## Papelera

- Enviar a la papelera marca `isDeleted` y un `deletionId` compartido por todo el subárbol; `isDeletionRoot` identifica lo solicitado directamente. No libera cuota.
- La papelera solo la gestiona el propietario, incluso si otro usuario tiene permiso `edit`.
- Restaurar exige un destino válido del mismo propietario, no eliminado y con permiso `edit`; si el nombre está ocupado devuelve 409.
- Los permisos se conservan al enviar a la papelera y al restaurar.
- El borrado definitivo elimina en una transacción la metadata, los shares y la cuota; después borra el contenido GridFS. Los logs se conservan.
- Si falla el borrado en GridFS se registra un log de error con `GRIDFS_DELETE_FAILED`.

## Reportes

- Son exclusivos de administradores y trabajan solo con metadatos; nunca leen el contenido de los archivos.
- Los reportes de operaciones cuentan únicamente registros con `status: 'success'`.
- Los reportes de almacenamiento excluyen archivos eliminados.
- Los rankings de compartición incluyen shares manuales y automáticos, salvo el ranking de archivos compartidos con más usuarios, que usa solo shares manuales.
- Los reportes históricos usan `resourceSnapshot` cuando el recurso ya no existe.
- Las fechas se interpretan en la zona `America/Guatemala` y los rangos son inclusivos.
- El módulo expone listados paginados y selectores de usuarios para filtrar por propietario o destinatario.

## Búsqueda y filtros

- La búsqueda es unificada para archivos y carpetas y usa los alcances `own`, `shared` y `all`.
- El alcance `shared` incluye shares directos y la herencia por `ancestors`: compartir una carpeta hace visibles sus subcarpetas y archivos.
- Los resultados de carpetas y archivos se combinan en Node, se ordenan por nombre y se paginan de forma conjunta.
- Cada resultado incluye el permiso efectivo para mostrar solo las acciones válidas.
- El filtro de archivos admite categoría, rango de fechas y alcance; `from > to` devuelve 400.

## Interfaz

- El tema claro/oscuro es manual mediante la clase `.app-dark` y se persiste en `localStorage`.
- La vista de explorador, compartidos y papelera reutiliza el componente `app-drive-view`.
- La vista previa reutiliza `app-file-preview-dialog` y escapa el contenido automáticamente con Angular.
