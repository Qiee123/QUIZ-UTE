@echo off
title HCMUTE Triết Học EduQuiz - Online Tunnel
color 0A
echo ======================================================
echo    TRUONG DAI HOC SU PHAM KY THUAT TP. HO CHI MINH
echo       KHOA LY LUAN CHINH TRI - NHOM VI
echo       DANG MO CONG TRUY CAP ONLINE INTERNET TOAN CAU
echo ======================================================
echo.
cd /d "%~dp0"

:: Start local server if not running
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set RUNNING=1
)

if not defined RUNNING (
    echo [1/2] Dang khoi dong Web App tren cong 3000...
    start /b node server.js
    timeout /t 2 >nul
)

echo [2/2] Dang tao duong link Online truc tuyen...
echo Link truy cap Online se xuat hien ben duoi (cho vai giay)...
echo.
npx -y localtunnel --port 3000 --subdomain hcmute-triet-quiz
pause
