@echo off
REM Install npm packages without relying on PATH.
setlocal
cd /d "%~dp0"
set "NPM=C:\Program Files\nodejs\npm.cmd"
if not exist "%NPM%" set "NPM=%LocalAppData%\Programs\nodejs\npm.cmd"
if not exist "%NPM%" (
  echo ERROR: npm.cmd not found. Install Node.js from https://nodejs.org/
  exit /b 1
)
call "%NPM%" install %*
