@echo off
REM Runs Next.js dev without relying on PATH (uses node.exe + local next binary).
setlocal
cd /d "%~dp0"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" (
  echo ERROR: Node.js not found at "%NODE_EXE%"
  echo Install Node.js from https://nodejs.org/ or adjust NODE_EXE in next-dev.cmd
  exit /b 1
)
if not exist "node_modules\next\dist\bin\next" (
  echo ERROR: Dependencies missing. Run install-deps.cmd first.
  exit /b 1
)
"%NODE_EXE%" "%CD%\node_modules\next\dist\bin\next" dev --turbopack %*
