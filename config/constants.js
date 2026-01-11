require("dotenv").config();

// Ollama configuration
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434/api";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "phi";
const OLLAMA_IMAGE_MODEL = process.env.OLLAMA_IMAGE_MODEL || "llava";
const OLLAMA_IMAGE_GEN_MODEL = process.env.OLLAMA_IMAGE_GEN_MODEL || "flux"; // Image generation model (e.g., flux, sdxl)

// GPU configuration
const OLLAMA_GPU_ENABLED = process.env.OLLAMA_GPU_ENABLED !== "false"; // GPU enabled by default
const OLLAMA_GPU_LAYERS = parseInt(process.env.OLLAMA_GPU_LAYERS) || -1; // -1 = all layers on GPU
const OLLAMA_NUM_THREADS = parseInt(process.env.OLLAMA_NUM_THREADS) || 0; // 0 = auto-detect
const OLLAMA_NUM_GPU = parseInt(process.env.OLLAMA_NUM_GPU) || 1; // Number of GPUs to use

const DCOLON = process.env.DCOLON || "879342868370698332";
const DCOLON_CHANNEL = process.env.DCOLON_CHANNEL || "1282597999658143776";

// Discord configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BOT_NAME = process.env.BOT_NAME || "Jasmine 🌼";
const PREFIX = process.env.PREFIX || "!";
const PROMPT_TRIGGER = process.env.PROMPT_TRIGGER || "map";

// File paths
const REMEMBER_FILE = "./remember.json";

module.exports = {
    OLLAMA_API_URL,
    OLLAMA_CHAT_MODEL,
    OLLAMA_IMAGE_MODEL,
    OLLAMA_IMAGE_GEN_MODEL,
    OLLAMA_GPU_ENABLED,
    OLLAMA_GPU_LAYERS,
    OLLAMA_NUM_THREADS,
    OLLAMA_NUM_GPU,
    DISCORD_TOKEN,
    BOT_NAME,
    PREFIX,
    PROMPT_TRIGGER,
    REMEMBER_FILE,
    DCOLON,
    DCOLON_CHANNEL,
};
