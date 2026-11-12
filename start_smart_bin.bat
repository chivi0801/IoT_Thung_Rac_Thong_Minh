@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

if not defined ESP32_BINS_URL set "ESP32_BINS_URL=http://10.95.24.60/bins"
if not defined ESP32_SERVO_URL set "ESP32_SERVO_URL=http://10.95.24.60/servo"

rem Reuse the CUDA-enabled environment from D:\PhanLoaiRac_test on this PC.
rem Set SMART_BIN_PYTHON to override this path; other PCs fall back to back_end\.venv.
if not defined SMART_BIN_PYTHON if exist "D:\PhanLoaiRac_test\.venv\Scripts\python.exe" set "SMART_BIN_PYTHON=D:\PhanLoaiRac_test\.venv\Scripts\python.exe"
if not defined SMART_BIN_PYTHON set "SMART_BIN_PYTHON=%~dp0back_end\.venv\Scripts\python.exe"

if /I "%SMART_BIN_PYTHON%"=="%~dp0back_end\.venv\Scripts\python.exe" if not exist "%SMART_BIN_PYTHON%" (
    echo Creating Python environment...
    py -3 -m venv back_end\.venv
    if errorlevel 1 goto setup_failed
)

if not exist "%SMART_BIN_PYTHON%" goto python_not_found

echo Using Python: %SMART_BIN_PYTHON%
"%SMART_BIN_PYTHON%" -c "import flask, cv2, numpy, ultralytics, torch" >nul 2>&1
if errorlevel 1 (
    if /I not "%SMART_BIN_PYTHON%"=="%~dp0back_end\.venv\Scripts\python.exe" goto shared_python_missing
    echo Installing backend requirements. This may take several minutes on first run...
    "%SMART_BIN_PYTHON%" -m pip install -r back_end\requirements.txt
    if errorlevel 1 goto setup_failed
)

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/health -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto open_web

echo Starting Smart Bin backend...
start "Smart Bin Backend" "%SMART_BIN_PYTHON%" "back_end\app.py"
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

:python_not_found
echo Python was not found: %SMART_BIN_PYTHON%
pause
exit /b 1

:shared_python_missing
echo The selected shared Python environment is missing required packages.
echo No packages were installed. Select another SMART_BIN_PYTHON or install dependencies manually.
pause
exit /b 1

:server_timeout
echo Backend did not start. Check the Smart Bin Backend window for the error.
pause
exit /b 1
