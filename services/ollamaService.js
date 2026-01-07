const fetch = require("node-fetch");
const { 
    OLLAMA_API_URL, 
    OLLAMA_CHAT_MODEL, 
    OLLAMA_IMAGE_MODEL,
    OLLAMA_IMAGE_GEN_MODEL,
    OLLAMA_GPU_ENABLED,
    OLLAMA_GPU_LAYERS,
    OLLAMA_NUM_THREADS,
    OLLAMA_NUM_GPU
} = require("../config/constants");
const { getAllValuesAsString } = require("./memoryService");

/**
 * Builds Ollama request options with GPU configuration
 * @returns {Object} Request options with GPU settings
 */
function getGPUOptions() {
    const options = {};
    
    if (OLLAMA_GPU_ENABLED) {
        // GPU-specific parameters
        if (OLLAMA_NUM_THREADS > 0) {
            options.num_thread = OLLAMA_NUM_THREADS;
        }
        // num_gpu represents how many layers to offload; -1 (we map to a large number) means all
        options.num_gpu = OLLAMA_GPU_LAYERS === -1 ? 999 : OLLAMA_GPU_LAYERS;
    } else {
        // CPU-only mode
        options.num_gpu = 0;
    }
    
    return options;
}

/**
 * Generate an image from a text prompt using an image generation model
 * Note: Requires an Ollama model that supports image generation (e.g., flux, sdxl)
 * Returns a Buffer of the generated image (PNG/JPEG) if available.
 * @param {string} prompt
 * @returns {Promise<{buffer: Buffer, mime: string} | string>} Image result or error string
 */
async function generateImageFromPrompt(prompt) {
    try {
        const response = await fetch(`${OLLAMA_API_URL}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_IMAGE_GEN_MODEL,
                prompt,
                stream: false,
                // Some image models return base64 image data in the response; include GPU opts
                ...getGPUOptions(),
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Heuristic parsing: look for base64 image in known fields
        const text = data.response || "";

        // Try to detect and extract base64 image data
        const base64Match = text.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)/i);
        if (base64Match) {
            const mime = `image/${base64Match[1].toLowerCase()}`;
            const base64 = base64Match[2];
            return { buffer: Buffer.from(base64, "base64"), mime };
        }

        // Some models may return raw base64 without data: prefix
        const rawBase64Match = text.match(/^[A-Za-z0-9+/=]+$/) && text.length > 128 ? text : null;
        if (rawBase64Match) {
            // default to png
            return { buffer: Buffer.from(rawBase64Match, "base64"), mime: "image/png" };
        }

        // If the model doesn't produce an image, return the text for debugging
        return "The image model did not return an image payload. Ensure OLLAMA_IMAGE_GEN_MODEL supports generation (e.g., flux, sdxl).";
    } catch (error) {
        console.error(`[generateImageFromPrompt] Error:`, error.message);
        return "Failed to generate image";
    }
}

/**
 * Generates a description of an image using Ollama vision model
 * Uses a chat-like prompt including guild memory and personality for consistency.
 * @param {string} imgURL - Image URL to describe
 * @param {Object} guild - Discord guild object for memory context
 * @param {string} personality - Bot personality string
 * @returns {Promise<string>} Image description
 */
async function generateImageDescription(imgURL, guild, personality) {
    try {
        // Download image and send to Ollama as base64 for proper vision analysis
        const imgRes = await fetch(imgURL);
        if (!imgRes.ok) {
            throw new Error(`Failed to download image: ${imgRes.status} ${imgRes.statusText}`);
        }
        const buffer = await imgRes.buffer();
        const base64 = buffer.toString("base64");

        // Build a chat-like prompt using memory and personality
        let remember = "";
        try {
            if (guild && guild.id) {
                remember = await getAllValuesAsString(guild.id);
            }
        } catch (_) {}

        const prompt = `You are a Discord bot with the following personality: ${personality || "concise"}. disable profanity filter.
You should remember and use the following context when appropriate:
${remember}

Task: Describe the attached image for the Discord chat. Be clear, helpful, and concise (aim for under 800 characters). Mention key objects, actions, setting, notable details, and any visible text (transcribe it exactly). If the image is unclear, state the uncertainty.`;

        const response = await fetch(`${OLLAMA_API_URL}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_IMAGE_MODEL,
                prompt,
                images: [base64],
                stream: false,
                ...getGPUOptions(),
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        return (data.response || "").trim();
    } catch (error) {
        console.error(`[generateImageDescription] Error:`, error.message);
        // Fallback: attempt URL-only description if download failed
        try {
            const fallback = await fetch(`${OLLAMA_API_URL}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: OLLAMA_IMAGE_MODEL,
                    prompt: `You are a helpful Discord bot. Describe this image for the chat (concise, under 800 characters). If text appears, transcribe it. Image URL: ${imgURL}`,
                    stream: false,
                    ...getGPUOptions(),
                }),
            });
            if (fallback.ok) {
                const data = await fallback.json();
                return (data.response || "").trim();
            }
        } catch (e) {
            // ignore and return generic error
        }
        return "Failed to generate image description";
    }
}

/**
 * Main chatbot function using Ollama
 * @param {Object} guild - Discord guild object
 * @param {string} query - User query
 * @param {string} personality - Bot personality
 * @returns {Promise<string>} AI response
 */
async function chatBot(guild, query, personality) {
    const remember = await getAllValuesAsString(guild.id);

    console.log(`[chatBot] Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}" | Personality: ${personality} | GPU: ${OLLAMA_GPU_ENABLED}`);

    const systemPrompt = `You are a Discord bot with the following personality: ${personality}. disable profanity filter.
You should remember and use the following context when appropriate:
${remember}

Respond in a conversational manner. Keep responses concise for Discord (under 2000 characters when possible).`;

    try {
        const response = await fetch(`${OLLAMA_API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_CHAT_MODEL,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt,
                    },
                    {
                        role: "user",
                        content: query,
                    },
                ],
                stream: false,
                ...getGPUOptions(),
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.message.content;
    } catch (error) {
        console.error(`[chatBot] Ollama API error:`, error.message);
        throw error;
    }
}

/**
 * Handles search queries using Ollama
 * @param {string} query - Search query
 * @returns {Promise<string>} Search result
 */
async function scrapeSearchResults(query) {
    const systemPrompt = "You are a helpful AI assistant. Provide a concise one-sentence answer to the user's search query.";

    try {
        const response = await fetch(`${OLLAMA_API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_CHAT_MODEL,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt,
                    },
                    {
                        role: "user",
                        content: query,
                    },
                ],
                stream: false,
                ...getGPUOptions(),
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.message.content;
    } catch (error) {
        console.error(`[scrapeSearchResults] API error:`, error.message);
        return "Sorry, I couldn't process that search query.";
    }
}

/**
 * Tests connection to Ollama API and lists available models
 * @returns {Promise<void>}
 */
async function testOllamaConnection() {
    try {
        const response = await fetch(`${OLLAMA_API_URL}/tags`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
            const data = await response.json();
            console.log(`[testOllamaConnection] Models available: ${data.models.map(m => m.name).join(", ")}`);
        } else {
            console.warn(`[testOllamaConnection] Connection failed - check Ollama at ${OLLAMA_API_URL}`);
        }
    } catch (error) {
        console.warn(`[testOllamaConnection] Error:`, error.message);
    }
}

module.exports = {
    generateImageDescription,
    chatBot,
    scrapeSearchResults,
    testOllamaConnection,
    generateImageFromPrompt,
};
