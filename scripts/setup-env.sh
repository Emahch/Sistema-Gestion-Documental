#!/usr/bin/env bash
# Genera api/.env para ejecutar la API SIN Docker.
#
# Lee los valores del .env de la raíz (el de Docker). Si no existe, usa
# .env.example, y si tampoco existe, usa valores por defecto.
# El cliente Angular no usa .env, por eso solo se genera el de la API.
#
# Uso:  bash scripts/setup-env.sh [--force]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/api/.env"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

# Archivo fuente de valores
SRC="$ROOT/.env"
[[ -f "$SRC" ]] || SRC="$ROOT/.env.example"

# get CLAVE VALOR_POR_DEFECTO -> imprime el valor de CLAVE en $SRC
get() {
  local line=""
  if [[ -f "$SRC" ]]; then
    line="$(grep -E "^[[:space:]]*$1=" "$SRC" | tail -n1 || true)"
  fi
  if [[ -n "$line" ]]; then
    local v="${line#*=}"
    v="${v%$'\r'}"; v="${v%\"}"; v="${v#\"}"
    echo "$v"
  else
    echo "$2"
  fi
}

# Codifica usuario/contraseña para usarlos dentro de la URI de Mongo
enc() { node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"; }

command -v node >/dev/null || { echo "ERROR: Node.js no está en el PATH." >&2; exit 1; }

if [[ -f "$DEST" && $FORCE -eq 0 ]]; then
  echo "api/.env ya existe. No se sobrescribe (usa --force para regenerarlo)."
  exit 0
fi

MONGO_USER="$(get MONGO_ROOT_USER admin)"
MONGO_PASS="$(get MONGO_ROOT_PASSWORD admin123)"
MONGO_DB="$(get MONGO_DB gestion_documental)"
MONGO_RS="$(get MONGO_REPLICA_SET rs0)"
MONGO_PORT="$(get MONGO_PORT 27017)"
API_PORT="$(get API_PORT "$(get PORT 3000)")"
CLIENT_PORT="$(get CLIENT_PORT 4200)"

# En local el host es 127.0.0.1 (en Docker es el servicio "mongo")
MONGO_URI="mongodb://$(enc "$MONGO_USER"):$(enc "$MONGO_PASS")@127.0.0.1:${MONGO_PORT}/${MONGO_DB}?authSource=admin&replicaSet=${MONGO_RS}&directConnection=true"

cat > "$DEST" <<EOF
# Generado por scripts/setup-env.sh (ejecución local sin Docker)
NODE_ENV=development
PORT=${API_PORT}
CLIENT_URL=http://localhost:${CLIENT_PORT}
MONGO_URI=${MONGO_URI}
JWT_SECRET=$(get JWT_SECRET dev-secret)
JWT_EXPIRES_IN=$(get JWT_EXPIRES_IN 8h)
ADMIN_EMAIL=$(get ADMIN_EMAIL admin@docsdrive.local)
ADMIN_PASSWORD=$(get ADMIN_PASSWORD 'Admin123*')
EOF

echo "Creado: api/.env (valores tomados de: ${SRC#"$ROOT"/})"
