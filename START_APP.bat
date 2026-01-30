@echo off
echo Starting Absensi Broadcast App...
echo.
echo Make sure you have run 'npm install' once!
echo.
echo Server will run on http://localhost:3001
echo.
start "Absensi App Server" cmd /k "node server.js"
timeout /t 5 >nul
start "" "http://localhost:3001"
echo Done.
