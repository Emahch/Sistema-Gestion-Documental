<#
.SYNOPSIS
  Genera api/.env para ejecutar la API SIN Docker.
.DESCRIPTION
  Lee los valores del .env de la raíz (el de Docker). Si no existe usa
  .env.example, y si tampoco existe usa valores por defecto.
  El cliente Angular no usa .env, por eso solo se genera el de la API.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-env.ps1 [-Force]
#>
param([switch]$Force)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Dest = Join-Path $Root 'api\.env'

# Archivo fuente de valores
$Src = Join-Path $Root '.env'
if (-not (Test-Path $Src)) { $Src = Join-Path $Root '.env.example' }

# Devuelve el valor de $Key en $Src, o $Default si no existe
function Get-Var([string]$Key, [string]$Default) {
  if (Test-Path $Src) {
    $m = Select-String -Path $Src -Pattern "^\s*$Key=(.*)$" | Select-Object -Last 1
    if ($m) { return $m.Matches[0].Groups[1].Value.Trim().Trim('"') }
  }
  return $Default
}

if ((Test-Path $Dest) -and -not $Force) {
  Write-Host 'api\.env ya existe. No se sobrescribe (usa -Force para regenerarlo).'
  exit 0
}

$MongoUser  = Get-Var 'MONGO_ROOT_USER' 'admin'
$MongoPass  = Get-Var 'MONGO_ROOT_PASSWORD' 'admin123'
$MongoDb    = Get-Var 'MONGO_DB' 'gestion_documental'
$MongoRs    = Get-Var 'MONGO_REPLICA_SET' 'rs0'
$MongoPort  = Get-Var 'MONGO_PORT' '27017'
$ApiPort    = Get-Var 'API_PORT' (Get-Var 'PORT' '3000')
$ClientPort = Get-Var 'CLIENT_PORT' '4200'

# En local el host es 127.0.0.1 (en Docker es el servicio "mongo")
$u = [uri]::EscapeDataString($MongoUser)
$p = [uri]::EscapeDataString($MongoPass)
$MongoUri = "mongodb://${u}:${p}@127.0.0.1:${MongoPort}/${MongoDb}?authSource=admin&replicaSet=${MongoRs}&directConnection=true"

$content = @"
# Generado por scripts/setup-env.ps1 (ejecución local sin Docker)
NODE_ENV=development
PORT=$ApiPort
CLIENT_URL=http://localhost:$ClientPort
MONGO_URI=$MongoUri
JWT_SECRET=$(Get-Var 'JWT_SECRET' 'dev-secret')
JWT_EXPIRES_IN=$(Get-Var 'JWT_EXPIRES_IN' '8h')
ADMIN_EMAIL=$(Get-Var 'ADMIN_EMAIL' 'admin@docsdrive.local')
ADMIN_PASSWORD=$(Get-Var 'ADMIN_PASSWORD' 'Admin123*')
"@

# Escribir sin BOM (dotenv puede fallar con BOM en la primera clave)
[IO.File]::WriteAllText($Dest, $content.Replace("`r`n", "`n"))

Write-Host "Creado: api\.env (valores tomados de: $(Split-Path -Leaf $Src))"
