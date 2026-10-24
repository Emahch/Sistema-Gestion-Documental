<#
.SYNOPSIS
  MongoDB local (sin Docker) con autenticación + keyfile + replica set.
  Replica lo que hace docker-compose (servicios mongo + mongo-init).
.DESCRIPTION
  Primer arranque (dos fases, igual que la imagen oficial de Docker):
    1) mongod SIN auth ni replSet -> crea el usuario root -> se apaga
    2) mongod CON --replSet y --keyFile -> rs.initiate
  Siguientes arranques: solo la fase 2.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\local-mongo.ps1 start
  powershell -ExecutionPolicy Bypass -File .\scripts\local-mongo.ps1 stop
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'status', 'reset')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

# Credenciales: .env de la raíz, o .env.example, o valores por defecto
$Src = Join-Path $Root '.env'
if (-not (Test-Path $Src)) { $Src = Join-Path $Root '.env.example' }
function Get-Var([string]$Key, [string]$Default) {
  if (Test-Path $Src) {
    $m = Select-String -Path $Src -Pattern "^\s*$Key=(.*)$" | Select-Object -Last 1
    if ($m) { return $m.Matches[0].Groups[1].Value.Trim().Trim('"') }
  }
  return $Default
}

$User = Get-Var 'MONGO_ROOT_USER' 'admin'
$Pass = Get-Var 'MONGO_ROOT_PASSWORD' 'admin123'
$Rs   = Get-Var 'MONGO_REPLICA_SET' 'rs0'
$Port = Get-Var 'MONGO_PORT' '27017'

# Datos en un directorio propio (distinto del de versiones anteriores sin auth)
$Base   = Join-Path $Root 'mongo-data\local-auth'
$DbPath = Join-Path $Base 'db'
$Key    = Join-Path $Base 'keyfile'
$Log    = Join-Path $Base 'mongod.log'
$Mark   = Join-Path $Base '.initialized'

# Variables de entorno que lee mongosh (evita problemas de comillas)
$env:MU = $User
$env:MP = $Pass

foreach ($bin in 'mongod', 'mongosh') {
  if (-not (Get-Command $bin -ErrorAction SilentlyContinue)) {
    throw "'$bin' no está en el PATH. Instala MongoDB Server y MongoDB Shell y reabre la terminal."
  }
}

# ¿mongod responde? (ping no requiere autenticación)
function Test-Up {
  try {
    & mongosh --host 127.0.0.1 --port $Port --quiet --eval "db.adminCommand('ping').ok" 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch { return $false }
}

function Wait-Mongo([bool]$WantUp) {
  for ($i = 0; $i -lt 40; $i++) {
    if ((Test-Up) -eq $WantUp) { return }
    Start-Sleep -Seconds 1
  }
  if ($WantUp) { throw "mongod no respondió. Revisa $Log" } else { throw 'mongod no se detuvo.' }
}

# mongosh autenticado
function Invoke-Msh {
  & mongosh --host 127.0.0.1 --port $Port -u $User -p $Pass --authenticationDatabase admin --quiet @args
}

function Start-Mongod([string[]]$Extra) {
  $mongod = (Get-Command mongod).Source
  $mArgs = @('--logpath', "`"$Log`"", '--logappend', '--dbpath', "`"$DbPath`"",
            '--port', $Port, '--bind_ip', '127.0.0.1') + $Extra
  Start-Process -FilePath $mongod -ArgumentList $mArgs -WindowStyle Hidden | Out-Null
}

function Do-Start {
  if (Test-Up) {
    if (-not (Test-Path $Mark)) {
      throw "Hay un mongod en el puerto $Port que no fue iniciado por este script. Detenlo (¿servicio de Windows?) o cambia MONGO_PORT en el .env."
    }
    Write-Host "MongoDB ya está en ejecución en 127.0.0.1:$Port"
    return
  }

  New-Item -ItemType Directory -Force $DbPath | Out-Null

  # Keyfile (se genera una sola vez): 756 bytes aleatorios en base64 (~1008 caracteres)
  if (-not (Test-Path $Key)) {
    $bytes = New-Object byte[] 756
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [IO.File]::WriteAllText($Key, [Convert]::ToBase64String($bytes))
    Write-Host "Keyfile generado en $Key"
  }

  # Fase 1: crear usuario root (solo la primera vez)
  if (-not (Test-Path $Mark)) {
    Write-Host "[1/2] Primer arranque: creando usuario root '$User'..."
    Start-Mongod @()
    Wait-Mongo $true
    & mongosh --host 127.0.0.1 --port $Port --quiet --eval "db.getSiblingDB('admin').createUser({user: process.env.MU, pwd: process.env.MP, roles: ['root']})" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el usuario root.' }
    try { & mongosh --host 127.0.0.1 --port $Port --quiet --eval "db.getSiblingDB('admin').shutdownServer({force: true})" 2>$null | Out-Null } catch { }
    Wait-Mongo $false
    New-Item -ItemType File -Force $Mark | Out-Null
  }

  # Fase 2: arranque definitivo con replica set + keyfile
  Write-Host "[2/2] Iniciando mongod con replica set '$Rs'..."
  Start-Mongod @('--replSet', $Rs, '--keyFile', "`"$Key`"")
  Wait-Mongo $true

  # rs.initiate (idempotente: si ya está iniciado no cambia nada)
  Invoke-Msh --eval "try { rs.status(); print('replica set ya iniciado') } catch (e) { rs.initiate({_id: '$Rs', members: [{_id: 0, host: '127.0.0.1:$Port'}]}); print('replica set iniciado') }"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar el replica set.' }

  # Esperar a que el nodo sea PRIMARY
  for ($i = 0; $i -lt 30; $i++) {
    $out = Invoke-Msh --eval 'db.hello().isWritablePrimary' 2>$null
    if ("$out" -match 'true') {
      Write-Host "MongoDB listo (PRIMARY) en 127.0.0.1:$Port"
      return
    }
    Start-Sleep -Seconds 1
  }
  throw "El nodo no llegó a PRIMARY. Revisa $Log"
}

function Do-Stop {
  if (-not (Test-Up)) { Write-Host 'MongoDB no está en ejecución.'; return }
  try { Invoke-Msh --eval "db.getSiblingDB('admin').shutdownServer({force: true})" 2>$null | Out-Null } catch { }
  Wait-Mongo $false
  Write-Host 'MongoDB detenido.'
}

function Do-Status {
  if (Test-Up) {
    Write-Host "mongod: en ejecución (127.0.0.1:$Port)"
    $ok = Invoke-Msh --eval 'rs.status().ok' 2>$null
    Write-Host "replica set ok: $ok"
  } else {
    Write-Host 'mongod: detenido'
  }
}

function Do-Reset {
  $ans = Read-Host "Esto BORRA todos los datos locales de MongoDB ($Base). ¿Continuar? [s/N]"
  if ($ans -notmatch '^[sSyY]$') { Write-Host 'Cancelado.'; return }
  Do-Stop
  if (Test-Path $Base) { Remove-Item -Recurse -Force $Base }
  Write-Host "Datos locales eliminados. El próximo 'start' creará todo desde cero."
}

switch ($Action) {
  'start'  { Do-Start }
  'stop'   { Do-Stop }
  'status' { Do-Status }
  'reset'  { Do-Reset }
}
