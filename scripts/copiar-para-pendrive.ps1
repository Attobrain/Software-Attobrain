# Copia o Attobrain pronto para uso em outro computador (sem .git, logs e arquivos de trabalho).
# Uso: .\scripts\copiar-para-pendrive.ps1 -Destino E:\
param([Parameter(Mandatory = $true)][string]$Destino)
$ErrorActionPreference = 'Stop'
$origem = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pasta = Join-Path $Destino 'Attobrain'
if (-not (Test-Path (Join-Path $origem 'dist\Attobrain.exe'))) { throw 'dist\Attobrain.exe não encontrado. Rode: npm run build:launcher' }
New-Item -ItemType Directory -Force -Path $pasta | Out-Null
# robocopy devolve códigos abaixo de 8 quando a cópia deu certo
robocopy $origem $pasta /E /XD .git work /XF *.log /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "A cópia falhou (robocopy código $LASTEXITCODE)." }
Write-Output "Pronto: $pasta"
Write-Output "No outro computador: ligue o MySQL no XAMPP e abra dist\Attobrain.exe."
