const { Client, GatewayIntentBits } = require("discord.js");
const { DISCORD_TOKEN, DCOLON, DCOLON_CHANNEL } = require("./config/constants");
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
	client.personality = "nice and cute";
	console.log(`[ready] Bot logged in: ${client.user.tag}`);

	// Test Ollama connection
	await testOllamaConnection();

	const dcolon = await client.guilds.fetch(DCOLON);
	const channel = dcolon.channels.cache.get(DCOLON_CHANNEL);
	channel.send(`I wake up.`);
});

client.on("messageCreate", handleMessage);

client.login(DISCORD_TOKEN);


