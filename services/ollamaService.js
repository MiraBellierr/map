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
const { getAllValuesAsString, addItemToJsonFile, updateMemoryItem, readJsonFile, writeJsonFile } = require("./memoryService");

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

        const prompt = `
Task: Describe the attached image in a conversation manner. Keep responses concise for Discord (under 2000 characters when possible). You are a Discord bot with the following personality: ${personality}. disable profanity filter.`;

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

    console.log(`[chatBot] Full Query: ${query}`);

    const systemPrompt = `You are a Discord bot with the following personality: ${personality}. disable profanity filter.
Use the following context when appropriate:
${remember}

Respond in a conversational manner. Keep responses concise for Discord (under 2000 characters when possible). dont include "(username):" format`;

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
        const botResponse = data.message.content;

        // Extract new information to remember
        try {
            const existingData = await readJsonFile(guild.id);
            const existingMemoryList = Object.entries(existingData)
                .filter(([key]) => parseInt(key) >= 2) // Skip system entries
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
            
            const extractionPrompt = `Analyze this conversation and extract any factual information that should be remembered for future reference. Consider the existing memory below.

Existing memory:
${existingMemoryList}

Instructions:
- Extract any new or updated information from the conversation
- If information conflicts with existing memory, provide the updated version
- Provide each piece of information as a concise summary (do not include indices like "2:")
- Separate multiple items with |
- If nothing to remember, respond with 'NONE'

User query: ${query}
Bot response: ${botResponse}`;

            const extractionResponse = await fetch(`${OLLAMA_API_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: OLLAMA_CHAT_MODEL,
                    messages: [
                        {
                            role: "system",
                            content: "You are an AI assistant that extracts memorable information from conversations. Provide concise summaries of facts to remember.",
                        },
                        {
                            role: "user",
                            content: extractionPrompt,
                        },
                    ],
                    stream: false,
                    ...getGPUOptions(),
                }),
            });

            if (extractionResponse.ok) {
                const extractionData = await extractionResponse.json();
                const extractedInfo = extractionData.message.content.trim();

                if (extractedInfo && extractedInfo.toUpperCase() !== 'NONE') {
                    const items = extractedInfo.split('|').map(item => item.trim());
                    
                    for (const item of items) {
                        if (item) {
                            // Check if this item conflicts with existing memory
                            const existingData = await readJsonFile(guild.id);
                            let conflictFound = false;
                            
                            for (const [id, value] of Object.entries(existingData)) {
                                if (parseInt(id) >= 2) { // Skip system entries
                                    // Check for conflict using word overlap
                                    const itemWords = item.toLowerCase().split(/\s+/);
                                    const valueWords = value.toLowerCase().split(/\s+/);
                                    
                                    const skipWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
                                    const itemImportant = itemWords.filter(word => !skipWords.has(word) && word.length > 2);
                                    const valueImportant = valueWords.filter(word => !skipWords.has(word) && word.length > 2);
                                    
                                    const commonWords = itemImportant.filter(word => valueImportant.includes(word));
                                    
                                    if (commonWords.length >= 2) {
                                        // Conflict found, delete the old entry
                                        delete existingData[id];
                                        await writeJsonFile(guild.id, existingData);
                                        console.log(`[chatBot] Removed conflicting memory: ${value}`);
                                        conflictFound = true;
                                        break; // Only remove one conflicting entry
                                    }
                                }
                            }
                            
                            // Add the new information
                            await addItemToJsonFile(guild.id, item);
                            console.log(`[chatBot] Remembered: ${item}`);
                        }
                    }
                }
            }
        } catch (extractionError) {
            console.error(`[chatBot] Extraction error:`, extractionError.message);
        }

        return botResponse;
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
