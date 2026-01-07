/**
 * Waits for a specified number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after the delay
 */
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Splits a long message into chunks that fit Discord's character limit
 * @param {string} message - The message to split
 * @returns {Array<string>} Array of message chunks
 */
function splitMessage(message) {
    const maxLength = 1900;
    const chunks = [];

    const words = message.split(" ");
    let currentChunk = "";

    words.forEach((word) => {
        if (currentChunk.length + word.length + 1 > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = word;
        } else {
            currentChunk += (currentChunk.length > 0 ? " " : "") + word;
        }
    });

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

module.exports = {
    wait,
    splitMessage,
};
