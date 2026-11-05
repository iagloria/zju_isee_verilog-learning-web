@echo off
setlocal
cd /d "%~dp0"

rem ==================================================================
rem  Push this project to GitHub.
rem  Double-click this file. A login window will appear the first time
rem  (sign in with your GitHub account, or paste a Personal Access Token).
rem ==================================================================

echo.
echo   ==========================================
echo     Push to GitHub
echo   ==========================================
echo.
echo   Remote : https://github.com/iagloria/zju_isee_verilog-learning-web.git
echo   Branch : main
echo.

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo   ERROR: not a git repository.
  pause
  exit /b 1
)

echo   Pending commits:
git --no-pager log origin/main..HEAD --oneline
echo.

echo   Pushing... a GitHub login window may appear.
echo.
git push -u origin main
if errorlevel 1 goto failed

echo.
echo   ==========================================
echo     SUCCESS
echo     https://github.com/iagloria/zju_isee_verilog-learning-web
echo   ==========================================
echo.
timeout /t 5 >nul 2>nul
exit /b 0

:failed
echo.
echo   Push failed.
echo   - If a login window appeared, complete the sign-in and run this again.
echo   - If it says "Authentication failed", you may need a Personal Access Token
echo     (GitHub: Settings > Developer settings > Personal access tokens).
echo.
pause
exit /b 1