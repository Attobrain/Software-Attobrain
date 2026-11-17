$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$compilerCandidates = @(
  'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
  'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
)
$compiler = $compilerCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $compiler) { throw 'O compilador C# do Windows (.NET Framework) não foi encontrado.' }

$icon = Join-Path $projectRoot 'assets\attobrain.ico'
$source = Join-Path $projectRoot 'launcher\AttobrainLauncher.cs'
$outputDirectory = Join-Path $projectRoot 'dist'
$runtimeDirectory = Join-Path $outputDirectory 'runtime'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$nodeVersion = (& $node --version).TrimStart('v')
try { $parsedNodeVersion = [version]$nodeVersion } catch { throw "Versão do Node.js inválida: $nodeVersion" }
if ($parsedNodeVersion.Major -lt 22) { throw 'O lançador requer Node.js 22 ou superior.' }

if (-not (Test-Path $icon)) { throw "Ícone não encontrado: $icon" }
if (-not (Test-Path $source)) { throw "Código do lançador não encontrado: $source" }
if (-not (Test-Path (Join-Path $projectRoot '.env'))) { throw 'Configure o arquivo .env antes de criar o executável.' }
if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) { throw 'Instale as dependências do projeto antes de criar o executável.' }

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$runtimeNode = Join-Path $runtimeDirectory 'node.exe'
if ((Resolve-Path $node).Path -ne (Resolve-Path $runtimeNode -ErrorAction SilentlyContinue).Path) {
  Copy-Item -LiteralPath $node -Destination $runtimeNode -Force
}

$executable = Join-Path $outputDirectory 'Attobrain.exe'
$arguments = @(
  '/nologo',
  '/codepage:65001',
  '/target:winexe',
  '/optimize+',
  '/platform:anycpu',
  "/win32icon:$icon",
  "/out:$executable",
  '/reference:System.Windows.Forms.dll',
  '/reference:System.Drawing.dll',
  $source
)
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'A compilação do Attobrain.exe falhou.' }

Write-Output "Executável criado: $executable"
Write-Output "Runtime incluído: $runtimeNode"
