const { ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { chatBot, generateImageDescription, generateImageFromPrompt } = require("../services/ollamaService");
const { 
    checkAndCreateGuildFile, 
    addItemToJsonFile, 
    removeItemFromJsonFile,
    readJsonFile
} = require("../services/memoryService");
const { displayJsonAsArray, generateEmbed } = require("../utils/embeds");
const { wait } = require("../utils/helpers");
const { addToQueue, addToImageQueue } = require("./queueHandler");

/**
 * Handles incoming Discord messages
 * @param {Object} message - Discord message object
 */
async function handleMessage(message) {
    if (message.author.bot) return;

    const guildID = message.guild.id;
    const serverName = message.guild.name;
    const contentLower = message.content.toLowerCase();

    await checkAndCreateGuildFile(guildID, serverName);

    // Mood command (owner only)
    if (message.author.id === "548050617889980426") {
        const normalizedContent = contentLower.trim();

        if (normalizedContent === "shut down") {
            try {
                await message.channel.sendTyping();
                const farewell = await chatBot(
                    message.guild,
                    `(owner request) shut down now. Respond once in your current personality and say goodbye.`,
                    message.client.personality
                );
                if (farewell) {
                    await message.reply(farewell);
                }
            } catch (e) {
                console.error(`[handleMessage] Shutdown response error:`, e.message);
            } finally {
                setTimeout(() => {
                    console.log("[handleMessage] Owner-triggered shutdown, forcing exit.");
                    try {
                        process.kill(process.pid, "SIGTERM");
                    } catch (killError) {
                        console.error("[handleMessage] SIGTERM failed, forcing exit.", killError.message);
                        process.exit(1);
                    }
                }, 2000);
            }
            return;
        }

        if (contentLower.startsWith("mood")) {
            const args = contentLower.split(" ");
            args.shift();
            const mood = args.join(" ");
            message.client.personality = mood;
            message.reply(`change mood to ${message.client.personality}`);
            return;
        }
    }

    // If user asks to describe an image, bypass chat and enqueue image task
    if (contentLower.includes("describe") && contentLower.includes("image")) {
        const imageUrls = [];
        if (message.attachments && message.attachments.size > 0) {
            for (const attachment of message.attachments.values()) {
                if (attachment.contentType && attachment.contentType.startsWith("image/")) {
                    imageUrls.push(attachment.url);
                }
            }
        }
        if (imageUrls.length === 0) {
            await message.reply("Please attach an image to describe.");
            return;
        }
        addToImageQueue(message, imageUrls);
        return;
    }

    let query;
    let search = false;

    // Handle reply messages
    if (message.reference) {
        const repliedMessageId = message.reference.messageId;
        const channel = message.channel;

        try {
            const originalMessage = await channel.messages.fetch(repliedMessageId);
            const isReplyingToBot = originalMessage.author.id === message.client.user.id;
            const repliedToUsername = originalMessage.author.username;

            // Case 1: Reply to other users with "map" prefix
            if (!isReplyingToBot && contentLower.startsWith("map")) {
                let image = " ";

                if (message.attachments.size > 0) {
                    for (const attachment of message.attachments.values()) {
                        if (attachment.contentType && attachment.contentType.startsWith("image/")) {
                            const imageUrl = attachment.url;
                            const desc = await generateImageDescription(imageUrl, message.guild, message.client.personality);
                            if (desc) {
                                image = desc;
                                try { await message.reply(desc); } catch (_) {}
                            }
                        }
                    }
                }

                query = `(CONTEXT: User ${message.author.username} is replying to ${repliedToUsername}'s message: "${originalMessage.content}") (Current user: ${message.author.username}, userid: ${message.author.id}) User's message: ${contentLower.replace("map ", "")} ${image}`;
            }
            // Case 2: Reply to bot (works without "map" prefix)
            else if (isReplyingToBot) {
                let image = " ";

                if (message.attachments.size > 0) {
                    for (const attachment of message.attachments.values()) {
                        if (attachment.contentType && attachment.contentType.startsWith("image/")) {
                            const imageUrl = attachment.url;
                            const desc = await generateImageDescription(imageUrl, message.guild, message.client.personality);
                            if (desc) {
                                image = desc;
                                try { await message.reply(desc); } catch (_) {}
                            }
                        }
                    }
                }

                query = `(CONTEXT: User ${message.author.username} is replying to YOUR previous message. Your previous message was: "${originalMessage.content}") (Current user: ${message.author.username}, userid: ${message.author.id}) User's reply: ${message.content} ${image}`;
            }
        } catch (error) {
            console.error(`[handleMessage] Fetch error:`, error.message);
        }
    } 
    // Handle map command
    else if (message.content.toLowerCase().startsWith("map")) {
        let image = " ";

        if (message.attachments.size > 0) {
            for (const attachment of message.attachments.values()) {
                if (attachment.contentType && attachment.contentType.startsWith("image/")) {
                    const imageUrl = attachment.url;
                    const desc = await generateImageDescription(imageUrl, message.guild, message.client.personality);
                    if (desc) {
                        image = desc;
                        try { await message.reply(desc); } catch (_) {}
                    }
                }
            }
        }

        query = `(username: ${message.author.username}, userid: ${message.author.id}) ${message.content
            .toLowerCase()
            .replace("map ", "")} ${image}`;
    } 
    // Handle search command
    else if (message.content.toLowerCase().startsWith("!search")) {
        query = message.content.toLowerCase().replace("!search ", "");
        search = true;
    } 
    // Handle image generation command
    else if (message.content.toLowerCase().startsWith("!img")) {
        const prompt = message.content.slice(4).trim();
        if (!prompt) {
            return message.reply("Provide a prompt, e.g., !img a sunset over mountains");
        }

        await message.channel.sendTyping();
        const result = await generateImageFromPrompt(prompt);
        if (typeof result === "string") {
            return message.reply(result);
        }

        const fileName = result.mime === "image/jpeg" ? "generated.jpg" : "generated.png";
        try {
            await message.channel.send({ files: [{ attachment: result.buffer, name: fileName }] });
        } catch (e) {
            console.error(`[handleMessage] Image send error:`, e.message);
            await message.reply("Failed to send generated image.");
        }
        return;
    }
    // Handle remember command
    else if (message.content.toLowerCase().startsWith("!remember")) {
        const context = message.content.toLowerCase().replace("!remember ", "");

        if (!context) return message.reply("What should I remember?");

        message.channel.send(await addItemToJsonFile(guildID, context));
        return;
    } 
    // Handle forget command
    else if (message.content.toLowerCase().startsWith("!forget")) {
        const contextId = message.content.toLowerCase().replace("!forget ", "");

        if (!contextId)
            return message.reply(
                "What should I forget? You need to give the ID though!"
            );

        if (parseInt(contextId) <= 1) {
            return message.reply("Cannot determine ID.");
        }

        message.channel.send(await removeItemFromJsonFile(guildID, contextId));
        return;
    } 
    // Handle list command with pagination
    else if (message.content.toLowerCase().startsWith("!list")) {
        const jsonData = await readJsonFile(guildID);
        const data = displayJsonAsArray(jsonData);
        const itemsPerPage = 10;
        let page = 0;

        const embed = generateEmbed(data, page, itemsPerPage);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("previous")
                .setLabel("Previous")
                .setStyle("Secondary")
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId("next")
                .setLabel("Next")
                .setStyle("Secondary")
                .setDisabled(data.length <= itemsPerPage)
        );

        const listMessage = await message.channel.send({ embeds: [embed], components: [row] });

        const filter = (interaction) => {
            return interaction.user.id === message.author.id;
        };

        const collector = listMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on("collect", async (interaction) => {
            if (interaction.customId === "previous") {
                page--;
            } else if (interaction.customId === "next") {
                page++;
            }

            const newEmbed = generateEmbed(data, page, itemsPerPage);
            const newRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("previous")
                    .setLabel("Previous")
                    .setStyle("Secondary")
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId("next")
                    .setLabel("Next")
                    .setStyle("Secondary")
                    .setDisabled(data.length <= (page + 1) * itemsPerPage)
            );

            await interaction.update({ embeds: [newEmbed], components: [newRow] });
        });

        collector.on("end", () => {
            listMessage.edit({ components: [] });
        });
        return;
    }

    // Add to queue if there's a query
    if (query) {
        addToQueue(message, query, search);
    }
}

module.exports = {
    handleMessage,
};
