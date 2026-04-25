@echo off
setlocal
cd /d "%~dp0"

git -c safe.directory="%CD%" rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  git init -b main
)

git -c safe.directory="%CD%" remote get-url origin >nul 2>nul
if errorlevel 1 (
  git -c safe.directory="%CD%" remote add origin https://github.com/RyanCheng08/Promotion-Review.git
) else (
  git -c safe.directory="%CD%" remote set-url origin https://github.com/RyanCheng08/Promotion-Review.git
)

git -c safe.directory="%CD%" branch -M main
git -c safe.directory="%CD%" add .
git -c safe.directory="%CD%" commit -m "Initial promotion review app"
git -c safe.directory="%CD%" push -u origin main

pause
