$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dockerEnvFile = Join-Path $repoRoot '.env'
Push-Location $repoRoot
try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "No se encontro 'docker' en PATH. Instala Docker Desktop y habilita Docker Compose."
  }
  if (-not (Test-Path $dockerEnvFile)) {
    throw "No se encontro el archivo de entorno para Docker en '$dockerEnvFile'."
  }

  Write-Host 'Verificando daemon de Docker...'
  docker info | Out-Null

  Write-Host "Usando configuracion Docker: $dockerEnvFile"
  Write-Host 'Levantando servicios con Docker Compose...'
  docker compose --env-file $dockerEnvFile up --build -d

  Write-Host ''
  Write-Host 'Servicios iniciados.'
  Write-Host 'API: http://localhost:3000'
  Write-Host 'Swagger: http://localhost:3000/api/docs'
  Write-Host 'Health: http://localhost:3000/api/health'
  Write-Host 'Cliente: http://localhost:4200'
}
finally {
  Pop-Location
}
