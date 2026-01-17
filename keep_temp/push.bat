@echo off
cd /d "%~dp0"

REM Get datetime from WMIC
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I

REM Extract parts
set yyyy=%dt:~0,4%
set mm=%dt:~4,2%
set dd=%dt:~6,2%
set hh=%dt:~8,2%
set min=%dt:~10,2%

REM Convert hour to 12-hour format
set ampm=AM
set /a h=%hh%
if %h% GEQ 12 (
    set ampm=PM
    if %h% GTR 12 set /a h-=12
)
if %h%==0 set h=12

REM Month name
set month=January
if %mm%==02 set month=February
if %mm%==03 set month=March
if %mm%==04 set month=April
if %mm%==05 set month=May
if %mm%==06 set month=June
if %mm%==07 set month=July
if %mm%==08 set month=August
if %mm%==09 set month=September
if %mm%==10 set month=October
if %mm%==11 set month=November
if %mm%==12 set month=December

REM Day suffix
set suffix=th
if %dd%==01 set suffix=st
if %dd%==02 set suffix=nd
if %dd%==03 set suffix=rd
if %dd%==21 set suffix=st
if %dd%==22 set suffix=nd
if %dd%==23 set suffix=rd
if %dd%==31 set suffix=st

set formatted=%h%:%min% %ampm% at %dd%%suffix% %month% %yyyy%

git add .
git commit -m "Update %formatted%"
git push origin main

echo.
echo Code pushed successfully: %formatted%
pause
