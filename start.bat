@echo off
echo 启动题库系统...

start "后端" cmd /k "cd /d %~dp0backend && npm run dev"
start "前端" cmd /k "cd /d %~dp0frontend && npm run dev"

echo 已启动！
