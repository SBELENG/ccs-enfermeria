@echo off
echo Mostrando el último reporte de pruebas...
cd apps\web
pnpm exec playwright show-report
pause
