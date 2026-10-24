#!/usr/bin/env bash
# MongoDB local (sin Docker) con autenticación + keyfile + replica set.
# Replica lo que hace docker-compose (servicios mongo + mongo-init).
#
# Uso:  bash scripts/local-mongo.sh [start|stop|status|reset]
#
# Primer arranque (dos fases, igual que la imagen oficial de Docker):
#   1) mongod SIN auth ni replSet -> crea el usuario root -> se apaga
#   2) mongod CON --replSet y --keyFile -> rs.initiate
# Siguientes arranques: solo la fase 2.
set -euo pipefail

ACTION="${1:-start}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Credenciales: .env de la raíz, o .env.example, o valores por defecto
SRC="$ROOT/.env"
[[ -f "$SRC" ]] || SRC="$ROOT/.env.example"
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

USER_ROOT="$(get MONGO_ROOT_USER admin)"
PASS_ROOT="$(get MONGO_ROOT_PASSWORD admin123)"
RS="$(get MONGO_REPLICA_SET rs0)"
PORT="$(get MONGO_PORT 27017)"

# Datos en un directorio propio (distinto del de versiones anteriores sin auth)
BASE="$ROOT/mongo-data/local-auth"
DBPATH="$BASE/db"
KEYFILE="$BASE/keyfile"
LOG="$BASE/mongod.log"
MARK="$BASE/.initialized"

# Variables de entorno que lee mongosh (evita problemas de comillas)
export MU="$USER_ROOT" MP="$PASS_ROOT"

for bin in mongod mongosh; do
  command -v "$bin" >/dev/null || { echo "ERROR: '$bin' no está en el PATH." >&2; exit 1; }
done

# ¿mongod responde? (ping no requiere autenticación)
is_up() {
  mongosh --host 127.0.0.1 --port "$PORT" --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1
}
wait_up() {
  for _ in $(seq 1 40); do is_up && return 0; sleep 1; done
  echo "ERROR: mongod no respondió. Revisa $LOG" >&2; return 1
}
wait_down() {
  for _ in $(seq 1 40); do is_up || return 0; sleep 1; done
  echo "ERROR: mongod no se detuvo." >&2; return 1
}
# mongosh autenticado
msh() {
  mongosh --host 127.0.0.1 --port "$PORT" -u "$USER_ROOT" -p "$PASS_ROOT" \
    --authenticationDatabase admin --quiet "$@"
}

do_start() {
  if is_up; then
    if [[ ! -f "$MARK" ]]; then
      echo "ERROR: hay un mongod en el puerto $PORT que no fue iniciado por este script." >&2
      echo "       Deténlo o cambia MONGO_PORT en el .env." >&2
      exit 1
    fi
    echo "MongoDB ya está en ejecución en 127.0.0.1:$PORT"
    return 0
  fi

  mkdir -p "$DBPATH"

  # Keyfile (se genera una sola vez). Mongo exige permisos 400/600.
  if [[ ! -f "$KEYFILE" ]]; then
    head -c 756 /dev/urandom | base64 | tr -d '\n' > "$KEYFILE"
    chmod 400 "$KEYFILE"
    echo "Keyfile generado en $KEYFILE"
  fi

  # Fase 1: crear usuario root (solo la primera vez)
  if [[ ! -f "$MARK" ]]; then
    echo "[1/2] Primer arranque: creando usuario root '$USER_ROOT'..."
    mongod --fork --logpath "$LOG" --logappend --dbpath "$DBPATH" \
      --port "$PORT" --bind_ip 127.0.0.1 >/dev/null
    wait_up
    mongosh --host 127.0.0.1 --port "$PORT" --quiet --eval \
      "db.getSiblingDB('admin').createUser({user: process.env.MU, pwd: process.env.MP, roles: ['root']})" >/dev/null
    mongosh --host 127.0.0.1 --port "$PORT" --quiet --eval \
      "db.getSiblingDB('admin').shutdownServer({force: true})" >/dev/null 2>&1 || true
    wait_down
    touch "$MARK"
  fi

  # Fase 2: arranque definitivo con replica set + keyfile
  echo "[2/2] Iniciando mongod con replica set '$RS'..."
  mongod --fork --logpath "$LOG" --logappend --dbpath "$DBPATH" \
    --port "$PORT" --bind_ip 127.0.0.1 \
    --replSet "$RS" --keyFile "$KEYFILE" >/dev/null
  wait_up

  # rs.initiate (idempotente: si ya está iniciado no cambia nada)
  msh --eval "try { rs.status(); print('replica set ya iniciado') } catch (e) { rs.initiate({_id: '$RS', members: [{_id: 0, host: '127.0.0.1:$PORT'}]}); print('replica set iniciado') }"

  # Esperar a que el nodo sea PRIMARY
  for _ in $(seq 1 30); do
    if msh --eval "db.hello().isWritablePrimary" 2>/dev/null | grep -q true; then
      echo "MongoDB listo (PRIMARY) en 127.0.0.1:$PORT"
      return 0
    fi
    sleep 1
  done
  echo "ERROR: el nodo no llegó a PRIMARY. Revisa $LOG" >&2
  exit 1
}

do_stop() {
  if ! is_up; then echo "MongoDB no está en ejecución."; return 0; fi
  msh --eval "db.getSiblingDB('admin').shutdownServer({force: true})" >/dev/null 2>&1 || true
  wait_down
  echo "MongoDB detenido."
}

do_status() {
  if is_up; then
    echo "mongod: en ejecución (127.0.0.1:$PORT)"
    msh --eval "rs.status().ok" 2>/dev/null | sed 's/^/replica set ok: /' || true
  else
    echo "mongod: detenido"
  fi
}

do_reset() {
  read -r -p "Esto BORRA todos los datos locales de MongoDB ($BASE). ¿Continuar? [s/N] " ans
  [[ "$ans" =~ ^[sSyY]$ ]] || { echo "Cancelado."; exit 0; }
  do_stop
  rm -rf "$BASE"
  echo "Datos locales eliminados. El próximo 'start' creará todo desde cero."
}

case "$ACTION" in
  start)  do_start ;;
  stop)   do_stop ;;
  status) do_status ;;
  reset)  do_reset ;;
  *) echo "Uso: $0 [start|stop|status|reset]" >&2; exit 1 ;;
esac
