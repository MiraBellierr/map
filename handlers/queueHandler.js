const { wait, splitMessage } = require("../utils/helpers");
const { chatBot, scrapeSearchResults } = require("../services/ollamaService");

const queue = [];
let isProcessing = false;

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
        const messages = splitMessage(
            result || "There was an error generating a response. Please try again."
        );

        for (const msg of messages) {
            await message.reply(msg).catch((e) => message.channel.send(e.message));
        }
    } catch (error) {
        console.error("Error processing queue:", error);
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

module.exports = {
    addToQueue,
};
