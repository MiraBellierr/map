const { Client, GatewayIntentBits } = require("discord.js");
const { DISCORD_TOKEN, DCOLON, DCOLON_CHANNEL, BOT_NAME } = require("./config/constants");
const { getAllValuesAsString } = require("./services/memoryService");
const { testOllamaConnection } = require("./services/ollamaService");
const { handleMessage } = require("./handlers/messageHandler");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	allowedMentions: {
		repliedUser: false,
	},
	page: "",
	personality: "rude",
}); 

client.once("ready", async () => {
	client.personality = `nice and cute, my name is ${BOT_NAME}`;
	console.log(`[ready] Bot logged in: ${client.user.tag}`);

	// Test Ollama connection
	await testOllamaConnection();

	const dcolon = await client.guilds.fetch(DCOLON);
	const channel = dcolon.channels.cache.get(DCOLON_CHANNEL);
	channel.send(`${BOT_NAME} wakes up.`);
});

client.on("messageCreate", handleMessage);

client.login(DISCORD_TOKEN);


