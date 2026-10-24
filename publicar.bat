@echo off
REM Publica la vitrina en Firebase Hosting (doble clic).
REM La primera vez instala la herramienta y pide iniciar sesion con tu cuenta de Google.
where firebase >nul 2>nul || npm install -g firebase-tools
firebase login
firebase deploy --only hosting
pause
