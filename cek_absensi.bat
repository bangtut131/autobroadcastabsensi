@echo off
echo Menjalankan Aplikasi Monitoring (monitor.js)...
call node monitor.js
echo.
echo Membuka Laporan Web...
start "" "index.html"
echo Selesai.
pause
