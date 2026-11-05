@echo off
setlocal
cd /d "%~dp0.."

rem Verilog Practice Lab - backup (pure ASCII)
set "NODE_EXE=node"
if exist "D:\node.js\node.exe" set "NODE_EXE=D:\node.js\node.exe"

"%NODE_EXE%" "%~dp0server\backup.js"
exit /b 0