@echo off
title DELTA-CRP Server (Puerto 3005) - Juigalpa
color 0B
echo ====================================================
echo  INICIANDO DELTA-CRP (CRM & ERP - JUIGALPA)
echo  Base de Datos: MySQL (deltastore_db)
echo  Puerto: 3005
echo ====================================================
cd /d "%~dp0"
node server.js
pause
