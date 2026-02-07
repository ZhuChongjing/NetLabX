@echo off
REM pack entry: call pack.ps1, exclude .git and submissions
setlocal
set "SCRIPT=%~dp0pack.ps1"
if not exist "%SCRIPT%" goto NOFILE

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
goto END

:NOFILE
echo pack.ps1 not found in %~dp0
pause

:END
endlocal
