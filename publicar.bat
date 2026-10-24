@echo off
cd /d "%~dp0"
REM Publica la vitrina en Firebase Hosting (doble clic).
where firebase >nul 2>nul || call npm install -g firebase-tools
call firebase login
call firebase deploy --only hosting
pause
