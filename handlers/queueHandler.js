const { wait, splitMessage } = require("../utils/helpers");
const { chatBot, scrapeSearchResults, generateImageDescription } = require("../services/ollamaService");

const queue = [];
let isProcessing = false;

// Separate queue for image descriptions
const imageQueue = [];
let isProcessingImages = false;

/**
 * Processes the message queue one by one
 */
async function processQueue() {
    if (isProcessing || queue.length === 0) return;

    isProcessing = true;
    const { message, query, search } = queue.shift();

    await message.channel.sendTyping();

    try {
        let result;
        if (search) {
            result = await scrapeSearchResults(query);
        } else {
            result = await chatBot(message.guild, query, message.client.personality);
        }

        // Fetch all emotes from the server
        const emotes = message.guild.emojis.cache;
        if (emotes.size > 0) {
            // Choose an appropriate emote based on the response content
            let selectedEmote = null;
            const lowerResult = result.toLowerCase();
            
            // Simple appropriateness check: if response contains positive words, prefer animated emotes or specific ones
            if (lowerResult.includes('cute') || lowerResult.includes('nice') || lowerResult.includes('good') || lowerResult.includes('love')) {
                // Try to find an emote with 'cute' or 'heart' in name, or animated
                selectedEmote = emotes.find(e => e.name.toLowerCase().includes('cute') || e.name.toLowerCase().includes('heart') || e.animated);
            }
            
            if (!selectedEmote) {
                // Fallback to random emote
                selectedEmote = emotes.random();
            }
            
            if (selectedEmote) {
                result += ' ' + selectedEmote.toString();
            }
        }

        const messages = splitMessage(
            result || "There was an error generating a response. Please try again."
        );

        for (const msg of messages) {
            await message.reply(msg).catch((e) => message.channel.send(e.message));
        }
    } catch (error) {
        console.error(`[processQueue] Error:`, error.message);
        await message.reply(
            "Failed to process request. Please try again."
        );
    }

    await wait(3000);

    isProcessing = false;

    if (queue.length > 0) {
        processQueue();
    }
}

/**
 * Adds a message to the processing queue
 * @param {Object} message - Discord message object
 * @param {string} query - Query to process
 * @param {boolean} search - Whether this is a search query
 */
function addToQueue(message, query, search = false) {
    queue.push({ message, query, search });
    processQueue();
}

/**
 * Processes the image description queue one by one
 */
async function processImageQueue() {
    if (isProcessingImages || imageQueue.length === 0) return;

    isProcessingImages = true;
    const { message, imageUrls } = imageQueue.shift();

    try {
        await message.channel.sendTyping();

        if (!imageUrls || imageUrls.length === 0) {
            await message.reply("No image found to describe.");
        } else {
            for (const url of imageUrls) {
                try {
                    const desc = await generateImageDescription(url, message.guild, message.client.personality);
                    let text = desc && typeof desc === "string" ? desc : "Failed to generate image description";

                    // Add appropriate emote to image description
                    const emotes = message.guild.emojis.cache;
                    if (emotes.size > 0) {
                        const lowerText = text.toLowerCase();
                        let selectedEmote = null;
                        
                        if (lowerText.includes('cute') || lowerText.includes('nice') || lowerText.includes('beautiful') || lowerText.includes('amazing')) {
                            selectedEmote = emotes.find(e => e.name.toLowerCase().includes('cute') || e.name.toLowerCase().includes('heart') || e.animated);
                        }
                        
                        if (!selectedEmote) {
                            selectedEmote = emotes.random();
                        }
                        
                        if (selectedEmote) {
                            text += ' ' + selectedEmote.toString();
                        }
                    }

                    await message.reply(text).catch((e) => message.channel.send(e.message));
                    await wait(1000);
                } catch (e) {
                    await message.reply("Failed to generate image description");
                }
            }
        }
    } catch (error) {
        console.error(`[processImageQueue] Error:`, error.message);
        await message.reply("Image evaluation failed. Please try again.");
    }

    await wait(1000);

    isProcessingImages = false;
    if (imageQueue.length > 0) {
        processImageQueue();
    }
}

/**
 * Adds an image description task to the separate queue
 * @param {Object} message - Discord message object
 * @param {string[]} imageUrls - Array of image URLs to describe
 */
function addToImageQueue(message, imageUrls) {
    imageQueue.push({ message, imageUrls });
    processImageQueue();
}

module.exports = {
    addToQueue,
    addToImageQueue,
};
