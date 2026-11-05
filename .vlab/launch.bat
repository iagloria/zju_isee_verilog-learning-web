@echo off
setlocal
cd /d "%~dp0"

rem Verilog Practice Lab - launcher (pure ASCII, do not add non-ASCII text)
set "NODE_EXE=node"
if exist "D:\node.js\node.exe" set "NODE_EXE=D:\node.js\node.exe"

"%NODE_EXE%" --version >nul 2>nul
if errorlevel 1 goto nonode

"%NODE_EXE%" "%~dp0server\launch.js"
if errorlevel 1 (
  echo.
  echo   Startup failed. Press any key to close this window.
  pause >nul
)
exit /b 0

:nonode
echo.
echo   Node.js was not found.
echo   Please install Node.js, or put node.exe at D:\node.js\
echo.
pause >nul
exit /b 1