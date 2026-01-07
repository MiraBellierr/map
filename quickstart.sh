#!/bin/bash
# Quick Start Script for Ollama AI Discord Bot

echo "🤖 Ollama AI Discord Bot - Quick Start"
echo "======================================"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed."
    echo "📥 Download from: https://ollama.ai"
    exit 1
fi

echo "✅ Ollama found"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "📥 Download from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found ($(node --version))"

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "❗ IMPORTANT: Edit .env and add your DISCORD_TOKEN"
    echo ""
    exit 1
fi

echo "✅ .env file found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Pull required models
echo ""
echo "📥 Pulling Ollama models (this may take a while)..."
ollama pull llama2
ollama pull llava

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the bot:"
echo "  1. Terminal 1: ollama serve"
echo "  2. Terminal 2: node index.js"
echo ""
