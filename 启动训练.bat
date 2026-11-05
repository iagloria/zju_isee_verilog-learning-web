@echo off
setlocal
rem ---------------------------------------------------------------
rem  Verilog Practice Lab - entry point in the review folder
rem  Pure ASCII on purpose. Uses pushd + a short relative name so
rem  cmd never has to parse a Chinese path.
rem ---------------------------------------------------------------
cd /d "%~dp0"
if not exist ".vlab" goto nocwd
pushd ".vlab"
if errorlevel 1 goto nocwd
call "%~1" 2>nul
call launch.bat
popd
exit /b 0

:nocwd
echo.
echo   Cannot enter the .vlab folder. Is the project complete?
echo.
pause >nul
exit /b 1