@echo off
setlocal enabledelayedexpansion
rem ==================================================================
rem  Fetch Icarus Verilog (third-party toolchain) into .vlab\tools
rem
rem  This project needs iverilog + vvp to judge your Verilog code.
rem  They are NOT stored in the repository (they are ~90MB of
rem  third-party binaries), so this script downloads them once.
rem
rem  Usage: just double-click this file.
rem ==================================================================

cd /d "%~dp0.."
set "TOOLS=%~dp0..\tools"
set "WORK=%~dp0..\data\download"

echo.
echo   ================================================
echo     Downloading Icarus Verilog (approx. 30 MB)
echo   ================================================
echo.

if exist "%TOOLS%\icarus\iverilogx.exe" if exist "%TOOLS%\icarus\vvpx.exe" (
  echo   Already installed:
  echo     %TOOLS%\icarus\iverilogx.exe
  echo   Nothing to do.
  echo.
  timeout /t 3 >nul 2>nul
  exit /b 0
)

set "NODE_EXE=node"
if exist "D:\node.js\node.exe" set "NODE_EXE=D:\node.js\node.exe"

"%NODE_EXE%" --version >nul 2>nul
if errorlevel 1 goto nonode

if not exist "%WORK%" mkdir "%WORK%"

rem ---- 1. download installer ----
echo   [1/3] Downloading...
set "URL=https://bleyer.org/icarus/iverilog-v14-20260804-x64_setup.exe"
set "SETUP=%WORK%\iverilog_setup.exe"
if exist "%SETUP%" del /q "%SETUP%"

"%NODE_EXE%" -e "const https=require('https'),fs=require('fs');const f=fs.createWriteStream(process.argv[2]);https.get(process.argv[1],r=>{if(r.statusCode!==200){console.error('HTTP '+r.statusCode);process.exit(1)}r.pipe(f);f.on('finish',()=>{f.close(()=>{console.log('   downloaded '+fs.statSync(process.argv[2]).size+' bytes');process.exit(0)})})}).on('error',e=>{console.error('download failed: '+e.message);process.exit(1)})" "%URL%" "%SETUP%"
if errorlevel 1 goto dlfail

rem ---- 2. extract ----
echo   [2/3] Extracting...
set "SEVENZ="
if exist "%ProgramFiles%\7-Zip\7z.exe" set "SEVENZ=%ProgramFiles%\7-Zip\7z.exe"
if exist "%ProgramFiles(x86)%\7-Zip\7z.exe" set "SEVENZ=%ProgramFiles(x86)%\7-Zip\7z.exe"
if exist "E:\git\Git\usr\bin\7z.exe" set "SEVENZ=E:\git\Git\usr\bin\7z.exe"
if exist "C:\Program Files\7-Zip\7z.exe" set "SEVENZ=C:\Program Files\7-Zip\7z.exe"

if "%SEVENZ%"=="" (
  echo   Extracting with built-in tar...
  if not exist "%WORK%\x" mkdir "%WORK%\x"
  tar -xf "%SETUP%" -C "%WORK%\x" 2>nul
  if errorlevel 1 goto noextract
  set "SRC=%WORK%\x"
) else (
  "%SEVENZ%" x "%SETUP%" -o"%WORK%\x" -y >nul
  if errorlevel 1 goto noextract
  set "SRC=%WORK%\x"
)

rem ---- 3. install into .vlab\tools ----
echo   [3/3] Installing...
if not exist "%TOOLS%" mkdir "%TOOLS%"
if not exist "%TOOLS%\bin" mkdir "%TOOLS%\bin"
if not exist "%TOOLS%\lib" mkdir "%TOOLS%\lib"
if not exist "%TOOLS%\include" mkdir "%TOOLS%\include"

xcopy "%SRC%\bin\*" "%TOOLS%\bin\" /E /I /Y /Q >nul 2>nul
xcopy "%SRC%\lib\*" "%TOOLS%\lib\" /E /I /Y /Q >nul 2>nul
xcopy "%SRC%\include\*" "%TOOLS%\include\" /E /I /Y /Q >nul 2>nul

rem ---- 4. build the two exe files the app expects ----
if not exist "%TOOLS%\icarus" mkdir "%TOOLS%\icarus"
copy /y "%TOOLS%\bin\iverilog.exe" "%TOOLS%\icarus\iverilogx.exe" >nul
copy /y "%TOOLS%\bin\vvp.exe" "%TOOLS%\icarus\vvpx.exe" >nul
copy /y "%TOOLS%\bin\*.dll" "%TOOLS%\icarus\" >nul 2>nul

if not exist "%TOOLS%\icarus\vvpx.exe" goto failed

echo.
echo   Done! Toolchain installed at:
echo     %TOOLS%\icarus
echo.
rd /s /q "%WORK%" >nul 2>nul
timeout /t 3 >nul 2>nul
exit /b 0

:dlfail
echo.
echo   Download failed. Check your network / proxy.
echo   Manual alternative:
echo     1. Download %URL%
echo     2. Install it, then copy bin\lib\include into .vlab\tools\
echo.
pause >nul
exit /b 1

:noextract
echo.
echo   Cannot extract the installer. Please install 7-Zip,
echo   or extract manually with any archive tool.
echo.
pause >nul
exit /b 1

:failed
echo.
echo   Installation incomplete - vvpx.exe not found.
echo.
pause >nul
exit /b 1

:nonode
echo.
echo   Node.js was not found.
echo   Please install Node.js (https://nodejs.org), or put node.exe at D:\node.js\
echo.
pause >nul
exit /b 1