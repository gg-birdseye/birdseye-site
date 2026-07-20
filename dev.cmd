@echo off
REM Prepends Node so child processes (next, node) always resolve.
set "NODEJS=%ProgramFiles%\nodejs"
set "NPM=%NODEJS%\npm.cmd"
if not exist "%NPM%" (
  set "NODEJS=%LocalAppData%\Programs\nodejs"
  set "NPM=%NODEJS%\npm.cmd"
)
if not exist "%NPM%" (
  echo Node.js was not found. Install it from https://nodejs.org/
  exit /b 1
)
set "PATH=%NODEJS%;%PATH%"
cd /d "%~dp0"
call "%NPM%" run dev %*
