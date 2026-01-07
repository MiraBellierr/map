const fs = require("fs").promises;

/**
 * Reads a JSON file for a specific guild
 * @param {string} guildID - Guild ID
 * @returns {Promise<Object>} Parsed JSON data
 */
async function readJsonFile(guildID) {
    const guildFilePath = `./${guildID}.json`;
    try {
        const data = await fs.readFile(guildFilePath, "utf-8");
        return data ? JSON.parse(data) : {};
    } catch (err) {
        if (err.code === "ENOENT") {
            return {};
        } else {
            throw err;
        }
    }
}

/**
 * Writes data to a guild's JSON file
 * @param {string} guildID - Guild ID
 * @param {Object} data - Data to write
 */
async function writeJsonFile(guildID, data) {
    const guildFilePath = `./${guildID}.json`;
    await fs.writeFile(guildFilePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Reads a guild-specific file
 * @param {string} guildID - Guild ID
 * @returns {Promise<Object>} Parsed JSON data
 */
async function readGuildFile(guildID) {
    const guildFilePath = `./${guildID}.json`;
    try {
        const data = await fs.readFile(guildFilePath, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        if (err.code === "ENOENT") {
            return {};
        } else {
            throw err;
        }
    }
}

/**
 * Checks if a guild file exists and creates it if not
 * @param {string} guildID - Guild ID
 * @param {string} serverName - Server name
 */
async function checkAndCreateGuildFile(guildID, serverName) {
    const guildFilePath = `./${guildID}.json`;
    try {
        await fs.access(guildFilePath);
    } catch (err) {
        if (err.code === "ENOENT") {
            const initialData = {
                "1": `You are in the server called ${serverName}.`,
            };
            await fs.writeFile(guildFilePath, JSON.stringify(initialData, null, 2), "utf-8");
        } else {
            throw err;
        }
    }
}

/**
 * Gets all values from guild and default files as a comma-separated string
 * @param {string} guildID - Guild ID
 * @returns {Promise<string>} All values joined by commas
 */
async function getAllValuesAsString(guildID) {
    const defaultData = await readJsonFile("default");
    const guildData = await readGuildFile(guildID);
    const combinedData = { ...defaultData, ...guildData };
    const values = Object.values(combinedData).join(",");
    return values;
}

/**
 * Adds a new item to the guild's memory
 * @param {string} guildID - Guild ID
 * @param {string} newItem - Item to remember
 * @returns {Promise<string>} Success message with item ID
 */
async function addItemToJsonFile(guildID, newItem) {
    const data = await readJsonFile(guildID);

    const keys = Object.keys(data);
    const newId =
        keys.length > 0 ? Math.max(...keys.map((key) => Number(key))) + 1 : 1;

    data[newId] = newItem;

    await writeJsonFile(guildID, data);
    return `Okay. Item ID is ${newId}. Please remember that!`;
}

/**
 * Removes an item from the guild's memory
 * @param {string} guildID - Guild ID
 * @param {string} id - Item ID to remove
 * @returns {Promise<string>} Success or error message
 */
async function removeItemFromJsonFile(guildID, id) {
    const data = await readJsonFile(guildID);

    if (!data[id]) {
        return `No item with ID ${id} found.`;
    }

    if (parseInt(id) < 5) {
        return `No item with ID ${id} found.`;
    }

    const removedItem = data[id];

    delete data[id];

    await writeJsonFile(guildID, data);
    return `Item with ID ${id} has been forgotten!\n\`${removedItem}\``;
}

module.exports = {
    readJsonFile,
    writeJsonFile,
    readGuildFile,
    checkAndCreateGuildFile,
    getAllValuesAsString,
    addItemToJsonFile,
    removeItemFromJsonFile,
};
