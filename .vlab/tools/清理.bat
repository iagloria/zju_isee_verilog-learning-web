@echo off
setlocal
cd /d "%~dp0"

rem Verilog Practice Lab - clean temporary files (pure ASCII)
rem Keeps: progress, saved answers, generated exam docs, problem bank, testbenches.
rem Removes: per-run temp dirs, precompiled cache, logs, download cache.

echo.
echo   This will delete temporary files:
echo     .vlab\data\runs\      per-run temp directories
echo     .vlab\data\cache\     precompiled cache (rebuilt on next start)
echo     .vlab\data\tmp\       compiler temp files
echo     .vlab\data\logs\      server logs
echo     .vlab\data\download\  downloaded installer
echo.
echo   Your progress, answers and exam docs are KEPT.
echo.
pause

if exist "data\runs" rmdir /s /q "data\runs"
if exist "data\cache" rmdir /s /q "data\cache"
if exist "data\tmp" rmdir /s /q "data\tmp"
if exist "data\logs" rmdir /s /q "data\logs"
if exist "data\download" rmdir /s /q "data\download"
if exist "tools\_proxy" rmdir /s /q "tools\_proxy"

del /q "data\last_port.txt" 2>nul
del /q "data\server.pid" 2>nul

mkdir "data\runs" 2>nul

echo.
echo   Done.
timeout /t 2 >nul 2>nul
exit /b 0