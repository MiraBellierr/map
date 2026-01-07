# Ollama AI Discord Bot

A fully-featured Discord bot powered by Ollama local AI models. This bot supports real-time chat interactions, image analysis, and persistent memory management—all running locally without external API dependencies.

## Features

- 🤖 **AI-Powered Chat** - Real-time responses using local Ollama models
- 🖼️ **Image Analysis** - Describe and analyze images attached to messages
- 💾 **Persistent Memory** - Remember context and information per guild
- ⚡ **GPU Acceleration** - Full NVIDIA GPU support for faster inference
- 🎭 **Personality System** - Customize bot behavior and personality
- 🔒 **Privacy-First** - Everything runs locally, no cloud dependencies
- 🏗️ **Modular Architecture** - Clean, maintainable codebase

## Prerequisites

- **Ollama** - Download from [ollama.ai](https://ollama.ai)
- **Node.js** - Version 16 or higher
- **Discord Bot Token** - Create a bot on [Discord Developer Portal](https://discord.com/developers/applications)
- **GPU (Optional)** - NVIDIA GPU with CUDA support for faster responses

## Quick Start

### 1. Install Ollama

Download and install Ollama from [ollama.ai](https://ollama.ai). Start the service:

```bash
ollama serve
```

### 2. Pull Models

In a new terminal, download models:

```bash
# Chat models (pick one)
ollama pull llama3.2        # Recommended - balanced
ollama pull phi             # Fast and small
ollama pull mistral         # High quality

# Image model (optional for image descriptions)
ollama pull moondream       # Lightweight image understanding
ollama pull llava           # Advanced image analysis
```

### 3. Clone & Install

```bash
git clone <repo-url>
cd map
npm install
```

### 4. Configure Environment

Create or update `.env` file:

```bash
# Discord
DISCORD_TOKEN=your_token_here

# Ollama Models
OLLAMA_CHAT_MODEL=llama3.2
OLLAMA_IMAGE_MODEL=moondream

# GPU Configuration
OLLAMA_GPU_ENABLED=true
OLLAMA_GPU_LAYERS=-1        # -1 = all layers on GPU

# Image Generation (optional)
# Set to an image generation model that Ollama supports (e.g., flux, sdxl)
OLLAMA_IMAGE_GEN_MODEL=flux
```

### 5. Update Guild Configuration

Edit the guild IDs in [config/constants.js](config/constants.js):
```javascript
const DCOLON = process.env.DCOLON || "your_guild_id";
const DCOLON_CHANNEL = process.env.DCOLON_CHANNEL || "your_channel_id";
```

Or set in `.env`:
```bash
DCOLON=your_guild_id
DCOLON_CHANNEL=your_channel_id
```

### 6. Run the Bot

```bash
npm start
# or
node index.js
```

## Commands

### Chat & Search
- **`map <message>`** - Ask the AI a question
- **`map` + image** - Analyze an attached image
- **`!search <query>`** - Search for information
- **`!img <prompt>`** - Generate an image using the configured image model

### Memory Management
- **`!remember <context>`** - Save context to bot memory
- **`!forget <id>`** - Remove a memory entry
- **`!list`** - View all stored memories (paginated)

### Admin Commands
- **`mood <personality>`** - Change bot personality (admin only)

Examples:
```
map What's the weather like?
map [reply to message] That's interesting!
map [attach image] Describe this image
!remember Python is a programming language
!list
```

## Configuration

### Environment Variables

```env
# Required
DISCORD_TOKEN=your_discord_token

# Ollama API
OLLAMA_API_URL=http://localhost:11434/api
OLLAMA_CHAT_MODEL=llama3.2
OLLAMA_IMAGE_MODEL=moondream

# GPU Acceleration
OLLAMA_GPU_ENABLED=true              # Enable/disable GPU
OLLAMA_GPU_LAYERS=-1                 # Layers on GPU (-1 = all)
OLLAMA_NUM_THREADS=0                 # CPU threads (0 = auto)
OLLAMA_NUM_GPU=1                     # Number of GPUs

# Discord Guild IDs
DCOLON=your_guild_id
DCOLON_CHANNEL=your_channel_id
```

### Recommended Models

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| phi | 2.7B | ⚡⚡⚡ | ⭐⭐ | Fast responses |
| llama3.2 | 3B | ⚡⚡ | ⭐⭐⭐ | Balanced |
| mistral | 7B | ⚡ | ⭐⭐⭐⭐ | High quality |
| neural-chat | 7B | ⚡ | ⭐⭐⭐ | Conversational |
| moondream | 1.7B | ⚡⚡⚡ | ⭐⭐ | Image analysis |
| llava | 7.4B | ⚡ | ⭐⭐⭐⭐ | Advanced images |
| flux | varies | ⚡⚡ | ⭐⭐⭐ | Image generation (text-to-image) |
| sdxl | 12B+ | ⚡ | ⭐⭐⭐⭐ | High-quality image generation |

### Performance Tuning

**For speed:**
```env
OLLAMA_CHAT_MODEL=phi
OLLAMA_IMAGE_MODEL=moondream
OLLAMA_GPU_LAYERS=-1
```

**For quality:**
```env
OLLAMA_CHAT_MODEL=mistral
OLLAMA_IMAGE_MODEL=llava
OLLAMA_GPU_LAYERS=-1
OLLAMA_IMAGE_GEN_MODEL=flux
```

**CPU-only mode:**
```env
OLLAMA_GPU_ENABLED=false
OLLAMA_NUM_THREADS=4
```

### Image Generation Notes
- Ensure you have pulled an image generation-capable model: `ollama pull flux` or `ollama pull sdxl`
- Not all models return raw image data. This bot attempts to parse base64 image content from the model response.
- If generation fails, switch to a different image model or update Ollama to the latest version.

## Project Structure

```
map/
├── config/
│   └── constants.js          # Configuration & env variables
├── services/
│   ├── ollamaService.js      # Ollama API integration
│   └── memoryService.js      # Guild memory management
├── handlers/
│   ├── messageHandler.js     # Command routing
│   └── queueHandler.js       # Message queue processing
├── utils/
│   ├── helpers.js            # Utility functions
│   └── embeds.js             # Discord embed generation
├── index.js                  # Main entry point
├── .env                      # Environment variables
└── *.json                    # Guild memory files
```

## Troubleshooting

### Bot Not Responding
- ✅ Verify `DISCORD_TOKEN` is correct and bot is invited to server
- ✅ Check message intents enabled in [Discord Developer Portal](https://discord.com/developers/applications)
- ✅ Ensure bot has permissions: Send Messages, Embed Links

### Ollama Connection Failed
- ✅ Ensure Ollama is running: `ollama serve`
- ✅ Test connection: `curl http://localhost:11434/api/tags`
- ✅ Check `OLLAMA_API_URL` in `.env` (default: `http://localhost:11434/api`)

### Out of Memory
- ✅ Use smaller model: `phi` (2.7B) instead of `mistral` (7B)
- ✅ Disable GPU: Set `OLLAMA_GPU_ENABLED=false`
- ✅ Close background applications

### Slow Responses
- ✅ Ensure GPU is enabled: `OLLAMA_GPU_ENABLED=true`
- ✅ Check GPU is detected: Run `nvidia-smi` in terminal
- ✅ Use faster model: Try `phi` or `llama3.2`
- ✅ Reduce GPU layers: Set `OLLAMA_GPU_LAYERS=20` (partial GPU)

### No GPU Detected
```bash
# Verify NVIDIA drivers
nvidia-smi

# Check Ollama GPU support
ollama list
# Should show models are using GPU in responses
```

## System Requirements

| Aspect | Minimum | Recommended |
|--------|---------|-------------|
| RAM | 4GB | 8GB+ |
| Storage | 4GB | 16GB+ |
| GPU VRAM | - | 2GB+ (NVIDIA) |
| CPU Cores | 2 | 4+ |

**GPU Support:**
- NVIDIA CUDA-capable GPUs (RTX, GTX, A100, H100, etc.)
- AMD GPUs via ROCm (via Ollama)
- Apple Silicon (via Ollama native support)

## Architecture

### Modular Design
The bot is organized into focused modules:
- **Config**: Centralized configuration management
- **Services**: Ollama API & memory management
- **Handlers**: Discord event handling & command routing
- **Utils**: Shared helper functions

### AI Pipeline
1. Message received → Handler processes command
2. Query built with context & personality
3. Sent to Ollama (with GPU acceleration if enabled)
4. Response split into Discord message chunks
5. Memory updated if `!remember` command used

## Development

### npm Scripts
```bash
npm start           # Run the bot
npm run dev         # Run with nodemon (auto-restart)
```

### Adding Custom Commands

Edit [handlers/messageHandler.js](handlers/messageHandler.js):
```javascript
else if (message.content.toLowerCase().startsWith("!custom")) {
    const customResponse = await myCustomLogic();
    message.reply(customResponse);
}
```

## Privacy & Security

- ✅ All processing happens locally
- ✅ No data sent to external servers (except Discord API)
- ✅ Guild data stored in local JSON files
- ✅ Complete control over model behavior

## License

ISC

## Support

For issues, questions, or suggestions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Ollama documentation: [ollama.ai](https://ollama.ai)
3. Check Discord.js documentation: [discord.js.org](https://discord.js.org)
