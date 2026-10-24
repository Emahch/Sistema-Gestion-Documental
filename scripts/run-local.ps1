param(
  [switch]$Install,
  [string]$MongoDbPath = '',
  [int]$MongoPort = 27017,
  [string]$ReplicaSet = 'rs0'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$apiDir = Join-Path $repoRoot 'api'
$clientDir = Join-Path $repoRoot 'client'
$mongoDataDir = if ($MongoDbPath) { $MongoDbPath } else { Join-Path $repoRoot 'mongo-data\local' }

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontro '$Name' en PATH. Instala Node.js 20+ y vuelve a intentar."
  }
}

function Invoke-Npm {
  param(
    [string]$WorkingDir,
    [string]$Arguments
  )
  Push-Location $WorkingDir
  try {
    cmd /c "npm $Arguments"
    if ($LASTEXITCODE -ne 0) {
      throw "Fallo 'npm $Arguments' en $WorkingDir"
    }
  }
  finally {
    Pop-Location
  }
}

function Write-EnvFileIfMissing {
  param(
    [string]$Path,
    [string]$Content
  )
  if (-not (Test-Path $Path)) {
    Set-Content -Path $Path -Value $Content -Encoding utf8
    Write-Host "Creado $Path"
  }
}

function Get-CommandPath {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "No se encontro '$Name' en PATH. Instala MongoDB 7+ y agrega su carpeta bin al PATH."
  }
  return $command.Source
}

function Wait-ForMongo {
  param([int]$Port)
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    if (Test-NetConnection -ComputerName '127.0.0.1' -Port $Port -InformationLevel Quiet) {
      return
    }
    Wait-Event -Timeout 1 | Out-Null
  }
  throw "MongoDB no respondio en 127.0.0.1:$Port despues de 30 segundos."
}

function Initialize-ReplicaSet {
  param(
    [string]$Mongosh,
    [int]$Port,
    [string]$Name
  )
  $script = "try { rs.status(); print('replica set ya iniciado') } catch (e) { rs.initiate({_id:'$Name',members:[{_id:0,host:'127.0.0.1:$Port'}]}); print('replica set iniciado') }"
  & $Mongosh --quiet --host 127.0.0.1 --port $Port --eval $script
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo inicializar el replica set '$Name'."
  }
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    & $Mongosh --quiet --host 127.0.0.1 --port $Port --eval "try { if (rs.status().myState === 1) { quit(0) } quit(1) } catch (e) { quit(1) }" | Out-Null
    if ($LASTEXITCODE -eq 0) {
      return
    }
    Wait-Event -Timeout 1 | Out-Null
  }
  throw "El replica set '$Name' no alcanzo el estado PRIMARY despues de 30 segundos."
}

Write-Host 'Verificando requisitos locales...'
Assert-Command -Name 'node'
Assert-Command -Name 'npm'

$envContent = @"
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://127.0.0.1:$MongoPort/gestion_documental?replicaSet=$ReplicaSet
JWT_SECRET=dev-secret
JWT_EXPIRES_IN=8h
ADMIN_EMAIL=admin@docsdrive.local
ADMIN_PASSWORD=Admin123*
"@
Write-EnvFileIfMissing -Path (Join-Path $apiDir '.env') -Content $envContent

$mongod = Get-CommandPath -Name 'mongod'
$mongosh = Get-CommandPath -Name 'mongosh'
$mongoReady = Test-NetConnection -ComputerName '127.0.0.1' -Port $MongoPort -InformationLevel Quiet
if (-not $mongoReady) {
  New-Item -ItemType Directory -Path $mongoDataDir -Force | Out-Null
  Write-Host "Iniciando MongoDB con replica set '$ReplicaSet'..."
  Start-Process -FilePath $mongod -ArgumentList @(
    '--dbpath', $mongoDataDir,
    '--port', $MongoPort,
    '--replSet', $ReplicaSet,
    '--bind_ip', '127.0.0.1'
  ) -WindowStyle Minimized | Out-Null
} else {
  Write-Host "MongoDB ya responde en 127.0.0.1:$MongoPort; no se iniciara otro proceso."
}

Wait-ForMongo -Port $MongoPort
Initialize-ReplicaSet -Mongosh $mongosh -Port $MongoPort -Name $ReplicaSet

if ($Install -or -not (Test-Path (Join-Path $apiDir 'node_modules'))) {
  Write-Host 'Instalando dependencias del API...'
  Invoke-Npm -WorkingDir $apiDir -Arguments 'install'
}

if ($Install -or -not (Test-Path (Join-Path $clientDir 'node_modules'))) {
  Write-Host 'Instalando dependencias del cliente...'
  Invoke-Npm -WorkingDir $clientDir -Arguments 'install'
}

$apiCommand = "Set-Location '$apiDir'; cmd /c npm run dev"
$clientCommand = "Set-Location '$clientDir'; cmd /c npm start"

Write-Host 'Iniciando API en una nueva terminal...'
Start-Process powershell -ArgumentList '-NoExit', '-Command', $apiCommand | Out-Null

Write-Host 'Iniciando cliente en una nueva terminal...'
Start-Process powershell -ArgumentList '-NoExit', '-Command', $clientCommand | Out-Null

Write-Host ''
Write-Host 'Aplicacion iniciada sin Docker.'
Write-Host 'API: http://localhost:3000'
Write-Host 'Swagger: http://localhost:3000/api/docs'
Write-Host 'Cliente: http://localhost:4200'
