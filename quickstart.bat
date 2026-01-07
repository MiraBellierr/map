@echo off
REM Quick Start Script for Ollama AI Discord Bot (Windows)

echo.
echo ========================================
echo   Ollama AI Discord Bot - Quick Start
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version

REM Check if .env exists
if not exist .env (
    echo.
    echo WARNING: .env file not found!
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env and add your DISCORD_TOKEN
    pause
    exit /b 1
)

echo [OK] .env file found
echo.

REM Install dependencies
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start the bot:
echo   1. Start Ollama (ollama serve) or run: ollama serve
echo   2. Run this script again or: node index.js
echo.
echo To pull models (if not already pulled):
echo   ollama pull llama2
echo   ollama pull llava
echo.
pause
