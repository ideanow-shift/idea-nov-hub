@echo off
setlocal
cd /d "%~dp0"
title IDEA NOV Store Sales Preview

echo.
echo ==========================================
echo   IDEA NOV Store Sales Preview
echo ==========================================
echo.
echo Your browser will open automatically.
echo Keep this window open while viewing Preview.
echo Close this window to stop Preview.
echo.

if "%PREVIEW_CHECK_ONLY%"=="1" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-store-sales-preview.ps1" -CheckOnly
) else (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-store-sales-preview.ps1"
)

if errorlevel 1 (
  echo.
  echo Preview could not be started.
  echo Please send a screenshot of the message above.
  echo.
  pause
)

endlocal
