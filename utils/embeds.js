const { EmbedBuilder } = require("discord.js");

/**
 * Converts JSON data to array format, filtering out early indices
 * @param {Object} data - JSON data object
 * @returns {Array} Array of [key, value] pairs
 */
function displayJsonAsArray(data) {
    const filteredData = Object.entries(data).filter(
        ([key]) => parseInt(key) >= 2
    );
    return filteredData;
}

/**
 * Generates an embed for paginated data display
 * @param {Array} data - Array of [key, value] pairs
 * @param {number} page - Current page number
 * @param {number} itemsPerPage - Items per page
 * @returns {EmbedBuilder} Discord embed
 */
function generateEmbed(data, page, itemsPerPage) {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = data.slice(start, end);

    const description = pageData.map(([key, value]) => `${key}: ${value}`).join("\n");

    const embed = new EmbedBuilder()
        .setTitle("List of Items")
        .setColor("#0099ff")
        .setDescription(description)
        .setFooter({ text: `Page ${page + 1} of ${Math.ceil(data.length / itemsPerPage)}` });

    return embed;
}

module.exports = {
    displayJsonAsArray,
    generateEmbed,
};
