@echo off
rem LE KIOSQUE - lance l'installateur avec le Node livre dans le kit (hors ligne).
chcp 65001 >nul
"%~dp0outils\node-win-x64\node.exe" "%~dp0outils\installer.mjs" %*
pause
