@echo off
setlocal
cd /d "%~dp0"

rem Verilog Practice Lab - stop the local server (port 7826)
rem Pure ASCII. No timeout/pause here: this script must also work
rem when run with redirected stdio.
set "NODE_EXE=node"
if exist "D:\node.js\node.exe" set "NODE_EXE=D:\node.js\node.exe"

"%NODE_EXE%" "%~dp0server\stop.js"
exit /b 0