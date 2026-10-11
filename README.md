# Sistema-Gestion-Documental
Aplicación web para la gestión de documentos, al estilo de un explorador de archivos utilizando MongoDB.

## Desarrollo (Docker)

```bash
docker compose up --build
```

- API: http://localhost:3000/api/health (nodemon, recarga al guardar en `api/src`)
- Client: http://localhost:4200 (ng serve, recarga al guardar en `client/src`)
- Mongo/Mongoose: localhost:27017, replica set `rs0` (transacciones y change streams)
- API docs (Swagger): http://localhost:3000/api/docs
- Admin inicial: `docker compose exec api npm run db:seed-admin` (`admin@docsdrive.local` / `Admin123*`)


## Reiniciar app sin afectar base de datos
```bash
docker compose stop client && docker compose rm -f client
docker volume rm sistema-gestion-documental_client-node-modules
docker compose up -d --build
```