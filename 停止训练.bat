@echo off
setlocal
cd /d "%~dp0"
if not exist ".vlab" goto nocwd
pushd ".vlab"
call stop.bat
popd
echo.
echo   Done. You can close this window.
timeout /t 3 >nul 2>nul
exit /b 0

:nocwd
echo.
echo   Cannot enter the .vlab folder.
echo.
pause >nul
exit /b 1