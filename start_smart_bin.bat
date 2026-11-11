@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

if not defined ESP32_BINS_URL set "ESP32_BINS_URL=http://192.168.1.31/bins"

if not exist "back_end\.venv\Scripts\python.exe" (
    echo Creating Python environment...
    py -3 -m venv back_end\.venv
    if errorlevel 1 goto setup_failed
)

"back_end\.venv\Scripts\python.exe" -c "import flask, cv2, numpy, ultralytics" >nul 2>&1
if errorlevel 1 (
    echo Installing backend requirements. This may take several minutes on first run...
    "back_end\.venv\Scripts\python.exe" -m pip install -r back_end\requirements.txt
    if errorlevel 1 goto setup_failed
)

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/health -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto open_web

echo Starting Smart Bin backend...
start "Smart Bin Backend" "back_end\.venv\Scripts\python.exe" "back_end\app.py"
set /a attempts=0

:wait_server
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/health -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto open_web
set /a attempts+=1
if !attempts! geq 90 goto server_timeout
timeout /t 1 /nobreak >nul
goto wait_server

:open_web
start "" "http://127.0.0.1:5000/tong-quan.html"
exit /b 0

:setup_failed
echo Backend setup failed. Check Python 3 and your internet connection, then try again.
pause
exit /b 1

:server_timeout
echo Backend did not start. Check the Smart Bin Backend window for the error.
pause
exit /b 1
