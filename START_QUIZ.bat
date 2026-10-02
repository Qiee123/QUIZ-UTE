@echo off
title HCMUTE Triết Học EduQuiz Server
color 0B
echo ======================================================
echo    TRUONG DAI HOC SU PHAM KY THUAT TP. HO CHI MINH
echo       KHOA LY LUAN CHINH TRI - NHOM VI
echo       HOC PHAN: TRIET HOC MAC - LENIN (LLCT130105)
echo ======================================================
echo Dang lam sach va khoi dong lai Web App Trac Nghiem...
cd /d "%~dp0"

:: Kill any existing process on port 3000 before starting
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

node server.js
pause
