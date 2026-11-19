@echo off
rem Plano B: abre o Attobrain sem usar o Attobrain.exe. Ligue o MySQL no XAMPP antes.
cd /d "%~dp0"
if not exist ".env" copy ".env.example" ".env" >nul
if not exist "dist\runtime\node.exe" (
  echo Nao encontrei dist\runtime\node.exe. Mantenha a pasta Attobrain completa.
  pause
  exit /b 1
)
echo Iniciando o Attobrain. Nao feche esta janela durante a apresentacao.
start "" cmd /c "timeout /t 5 >nul & start http://localhost:3000/login"
"dist\runtime\node.exe" --env-file=.env index.js
pause
