@echo off
echo Abriendo la interfaz visual de Playwright...
cd apps\web
pnpm run test:e2e:ui
pause
