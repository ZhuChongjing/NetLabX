@echo off
chcp 65001 >NUL
title 网络综合实验平台 - 一键启动

echo.
echo ========================================
echo   网络综合实验平台 - 启动服务
echo ========================================
echo.
echo [提示] 前端地址: http://localhost:5173
echo [提示] 后端地址: http://localhost:3001
echo.
echo [提示] 如需停止服务，请关闭所有命令窗口
echo.

:: 清理可能占用的端口
echo [1/3] Cleaning ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" 2^>NUL') do (
    taskkill /F /PID %%a > NUL 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" 2^>NUL') do (
    taskkill /F /PID %%a > NUL 2>&1
)
echo [OK] Ports ready
echo.

:: 启动前端服务
echo [2/3] Starting frontend...
start "前端服务-5173" cmd /k "chcp 65001 >NUL && cd /d "%~dp0" && npm run dev"
timeout /t 2 /nobreak > NUL 2>&1
echo [OK] Frontend started
echo.

:: 启动后端服务
echo [3/3] Starting backend...
start "后端服务-3001" cmd /k "chcp 65001 >NUL && cd /d "%~dp0" && npm run server"
echo [OK] Backend started
echo.

echo ========================================
echo   启动完成！
echo ========================================
echo.
echo 前端地址: http://localhost:5173
echo 后端地址: http://localhost:3001
echo.
echo [学生访问] 请将localhost替换为教师机的IP地址
echo [查看IP]   在新的命令窗口输入: ipconfig
echo.
echo [提示] 请保持新建的两个窗口打开，关闭窗口会停止对应服务，本窗口可按任意键关闭
echo.
pause
