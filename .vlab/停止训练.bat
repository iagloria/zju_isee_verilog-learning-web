@echo off
setlocal
cd /d "%~dp0"

rem ---------------------------------------------------------------
rem  Verilog Practice Lab - stop the local server (port 7826)
rem ---------------------------------------------------------------

set "NODE_EXE=node"
if exist "D:\node.js\node.exe" set "NODE_EXE=D:\node.js\node.exe"

"%NODE_EXE%" "%~dp0server\stop.js"
timeout /t 3 >nul
exit /b 0