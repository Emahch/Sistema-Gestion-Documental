# Decisiones del proyecto

Esquema e índices en vivo: [erd.md](./erd.md) (generado con `npm run db:diagram`).

## Tecnologías

- Angular 21 + PrimeNG 21 (preset Aura) · Express + Mongoose · MongoDB 7 replica set `rs0` single-node en dev (transacciones y change streams; producción: 3+ nodos).
- API en TypeScript estricto con `ts-node` en desarrollo (`tsc --noEmit` como verificación).
- Auth con JWT (`jsonwebtoken`, 8h) y hash con `bcryptjs`.
- Swagger UI con JSDoc estilo `*` (`swagger-jsdoc` lo exige a nivel de parser).

## Base de datos

- Colecciones: `users`, `folders`, `files`, `shares`, `activity_logs` + GridFS (`fs.files`, `fs.chunks`).
- `users.storage` embebido (`quotaBytes`, `usedBytes`); `null` = cuota ilimitada.
- `activity_logs` usa campo `timestamp` explícito (sin `updatedAt`).
- `ensure-indexes` solo suma índices; si uno cambia hay que borrar el viejo a mano.

## Reglas de negocio implementadas

### Auth y usuarios

- Sin autorregistro: solo admin crea usuarios; el primero nace con `db:seed-admin`.
- Crear usuario = transacción (usuario + carpeta raíz `Mi unidad` + log `USER_CREATE`).
- Login con `emailNormalized`; 401 genérico sin distinguir causa; cada petición revalida `isActive`.
- Email duplicado -> 409. 
- Cuota inicial configurable, `null` = ilimitada.
- Ajuste de cuota (solo admin).
- Nadie puede desactivarse ni quitarse el rol a sí mismo -> 400.
- `PATCH /api/users/me` (perfil propio: email/password) y `PATCH /api/users/:id` (admin: email/rol/password).
- Reconciliación de cuota solo lectura: compara `usedBytes` con la suma real.
