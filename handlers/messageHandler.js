const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require("discord.js");
const os = require('os');
const { chatBot, generateImageDescription, generateImageFromPrompt } = require("../services/ollamaService");
const { 
    checkAndCreateGuildFile
} = require("../services/memoryService");
const { wait } = require("../utils/helpers");
const { addToQueue, addToImageQueue } = require("./queueHandler");
const { PREFIX, PROMPT_TRIGGER, OLLAMA_GPU_ENABLED, OLLAMA_GPU_LAYERS, OLLAMA_NUM_GPU } = require("../config/constants");

/**
 * Handles incoming Discord messages
 * @param {Object} message - Discord message object
 */
async function handleMessage(message) {
    if (message.author.bot) return;

    const guildID = message.guild.id;
    const serverName = message.guild.name;
    const contentLower = message.content.toLowerCase();

    // Helper to get nickname or username
    function getDisplayName(member) {
        return (member && member.nickname) ? member.nickname : (member && member.user && member.user.username) ? member.user.username : member?.username || "Unknown";
    }

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

            // Fetch the full chain of replied messages (up to a safe depth)
            const replyChain = [];
            let currentMessage = originalMessage;
            replyChain.unshift(currentMessage); // immediate replied message at the end

            const MAX_CHAIN = 10;
            while (
                currentMessage &&
                currentMessage.reference &&
                currentMessage.reference.messageId &&
                replyChain.length < MAX_CHAIN
            ) {
                try {
                    const parent = await channel.messages.fetch(currentMessage.reference.messageId);
                    if (!parent) break;
                    replyChain.unshift(parent); // keep oldest-first order
                    currentMessage = parent;
                } catch (e) {
                    break;
                }
            }

            const isReplyingToBot = originalMessage.author.id === message.client.user.id;
            // Get display names for context
            const repliedToMember = message.guild.members.cache.get(originalMessage.author.id);
            const currentMember = message.guild.members.cache.get(message.author.id);
            const repliedToDisplayName = getDisplayName(repliedToMember) || originalMessage.author.username;
            const currentDisplayName = getDisplayName(currentMember) || message.author.username;
            const previousContext = replyChain.map(m => {
                const member = message.guild.members.cache.get(m.author.id);
                const displayName = getDisplayName(member) || m.author.username;
                return `${displayName}: ${m.content}`;
            }).join(' | ');

            // Case 1: Reply to other users with "map" prefix
            if (!isReplyingToBot && contentLower.startsWith(PROMPT_TRIGGER)) {
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

                query = `(CONTEXT: User ${currentDisplayName} is replying to ${repliedToDisplayName}'s message(s): "${previousContext}") (Current user: ${currentDisplayName}, userid: ${message.author.id}) User's message: ${contentLower.replace("map ", "")} ${image}`;
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

                query = `(CONTEXT: User ${currentDisplayName} is replying to YOUR previous message(s). Your previous messages were: "${previousContext}") (Current user: ${currentDisplayName}, userid: ${message.author.id}) User's reply: ${message.content} ${image}`;
            }
        } catch (error) {
            console.error(`[handleMessage] Fetch error:`, error.message);
        }
    } 
    // Handle map command
    else if (message.content.toLowerCase().startsWith(PROMPT_TRIGGER)) {
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

        const currentMember = message.guild.members.cache.get(message.author.id);
        const currentDisplayName = getDisplayName(currentMember) || message.author.username;
        query = `(username: ${currentDisplayName}, userid: ${message.author.id}) ${message.content
            .toLowerCase()
            .replace("map ", "")} ${image}`;
    } 
    // Handle search command
    else if (message.content.toLowerCase().startsWith(`${PREFIX}search`)) {
        query = message.content.toLowerCase().replace("!search ", "");
        search = true;
    } 
    // Handle image generation command
    else if (message.content.toLowerCase().startsWith(`${PREFIX}img`)) {
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
    // Handle info command
    else if (message.content.toLowerCase().startsWith(`${PREFIX}info`)) {
        const totalRam = os.totalmem();
        const freeRam = os.freemem();
        const usedRam = totalRam - freeRam;
        const ramUsage = `${(usedRam / totalRam * 100).toFixed(2)}% (${(usedRam / 1024 / 1024 / 1024).toFixed(2)} GB / ${(totalRam / 1024 / 1024 / 1024).toFixed(2)} GB)`;

        const osName = os.platform();
        const memoryUsage = process.memoryUsage();
        const heapUsed = `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`;

        const ping = `${message.client.ws.ping} ms`;

        const cpus = os.cpus();
        const cpuModel = cpus[0].model;
        const cpuCores = cpus.length;

        const gpuInfo = OLLAMA_GPU_ENABLED ? `Enabled (${OLLAMA_GPU_LAYERS} layers, ${OLLAMA_NUM_GPU} GPU(s))` : 'Disabled';

        const embed = new EmbedBuilder()
            .setTitle('Bot Info')
            .addFields(
                { name: 'OS', value: osName, inline: true },
                { name: 'CPU', value: `${cpuModel} (${cpuCores} cores)`, inline: true },
                { name: 'RAM Usage', value: ramUsage, inline: false },
                { name: 'Memory Usage (Heap)', value: heapUsed, inline: true },
                { name: 'GPU (Ollama)', value: gpuInfo, inline: true },
                { name: 'Ping', value: ping, inline: true }
            )
            .setColor('#0099ff');

        await message.reply({ embeds: [embed] });
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
