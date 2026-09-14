@echo off
REM ============================================================
REM  Vision Ingestion Spike — one-click runner cho Windows
REM
REM  Cach dung:
REM     1. Mo Command Prompt trong thu muc nay
REM     2. set GEMINI_API_KEY=AQ.Ab8...        (KHONG dat dau nhay)
REM     3. run_windows.bat
REM
REM  Hoac truyen key truc tiep:
REM     run_windows.bat AQ.Ab8...
REM ============================================================

setlocal

if not "%~1"=="" set GEMINI_API_KEY=%~1

echo.
echo ============================================================
echo  Vision Ingestion Spike - Concept vs Geometry
echo ============================================================
echo.

REM ── Tim Python launcher ────────────────────────────────────
set PYLAUNCH=
py --version >nul 2>&1 && set PYLAUNCH=py
if "%PYLAUNCH%"=="" (
    python --version >nul 2>&1 && set PYLAUNCH=python
)
if "%PYLAUNCH%"=="" (
    echo [X] Khong tim thay Python.
    echo     Cai tai https://www.python.org/downloads/
    echo     Nho tick "Add Python to PATH" khi cai.
    exit /b 1
)
echo [1/5] Python launcher: %PYLAUNCH%
%PYLAUNCH% --version

REM ── Tao venv ───────────────────────────────────────────────
if exist ".venv\Scripts\python.exe" (
    echo [2/5] venv da ton tai, bo qua buoc tao
) else (
    echo [2/5] Tao virtual environment...
    %PYLAUNCH% -m venv .venv
    if errorlevel 1 (
        echo [X] Tao venv that bai
        exit /b 1
    )
)

set VPY=.venv\Scripts\python.exe

REM ── Cai dependencies ───────────────────────────────────────
echo [3/5] Cai google-genai + pillow...
"%VPY%" -m pip install --quiet --upgrade pip
"%VPY%" -m pip install --quiet google-genai pillow
if errorlevel 1 (
    echo [X] Cai dependencies that bai
    exit /b 1
)

REM ── Self-test rubric (mien phi) ────────────────────────────
echo [4/5] Self-test rubric (khong ton API)...
"%VPY%" test_scoring.py
if errorlevel 1 (
    echo [X] Rubric self-test that bai - dung lai
    exit /b 1
)

REM ── Kiem tra key ───────────────────────────────────────────
if "%GEMINI_API_KEY%"=="" (
    echo.
    echo [X] Chua dat GEMINI_API_KEY
    echo.
    echo     Chay:  set GEMINI_API_KEY=AQ.Ab8...
    echo     Roi:   run_windows.bat
    echo.
    echo     Hoac:  run_windows.bat AQ.Ab8...
    echo.
    echo     Luu y: KHONG dat dau nhay quanh key trong cmd.exe
    exit /b 1
)

echo [5/5] Kiem tra API key...
"%VPY%" compare.py --check-key
if errorlevel 1 (
    echo.
    echo [X] Key khong hoat dong - xem thong bao loi o tren
    exit /b 1
)

REM ── Chay that ──────────────────────────────────────────────
echo.
echo ============================================================
echo  Bat dau chay: 11 anh x 2 che do = 22 luot goi (~$0.09)
echo  Mat khoang 2-3 phut...
echo ============================================================
echo.
"%VPY%" compare.py --model gemini
if errorlevel 1 (
    echo [X] compare.py that bai
    exit /b 1
)

echo.
echo ============================================================
echo  XONG! Mo file compare_report.html de xem ket qua.
echo  Gui file compare_report.md cho agent de sua PRD.
echo ============================================================
start "" compare_report.html

endlocal
