@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo   Store Sales Staging - Synthetic Data
echo ==========================================
echo.
echo No production systems are used.
echo Keep this window open while reviewing.
echo.
start "" "http://127.0.0.1:4175/portal/store-sales/staging.html"
node scripts\start-store-sales-staging.mjs
if errorlevel 1 (
  echo.
  echo Could not start Staging. Please send this screen to Codex.
  pause
)
endlocal
