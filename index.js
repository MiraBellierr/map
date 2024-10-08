const puppeteerExtra = require('puppeteer-extra');
const Stealth = require('puppeteer-extra-plugin-stealth');
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
const { convert } = require("html-to-text");
const remember = "./remember.json";
const fs = require('fs').promises;
const {ClarifaiStub, grpc} = require("clarifai-nodejs-grpc");

const stub = ClarifaiStub.grpc();

const metadata = new grpc.Metadata();
metadata.set("authorization", "Key 10d48b6a5ed14163a81537d3ad153731");

puppeteerExtra.use(Stealth());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  allowedMentions: {
    repliedUser: false,
  },
  page: "",
  personality: "nice",
  remember: "None"
});

function processImage(imgURL) {
  return new Promise((resolve, reject) => {
    let description;

    stub.PostModelOutputs(
      {
        model_id: "general-image-recognition",
        app_id: "main",
        user_id: "clarifai",
        inputs: [{data: {image: {url: imgURL}}}]
      },
      metadata,
      (err, response) => {
        if (err) {
          console.log("Error: " + err);
          description = "Failed to generate description";
          reject(description);
          return;
        }

        if (response.status.code !== 10000) {
          console.log("Received failed status: " + response.status.description + "\n" + response.status.details);
          description = "Failed to generate description";
          reject(description);
          return;
        }

        description = `Construct the description of the image based on the provided keywords: ${response.outputs[0].data.concepts.map(t => t.name).join(", ")}.`;
        resolve(description);
      }
    );
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function displayJsonAsString() {
  try {
      const data = await fs.readFile(remember, 'utf-8');
      
      const parsedData = JSON.parse(data);

      const filteredData = Object.fromEntries(
        Object.entries(parsedData).filter(([key]) => !["1", "2", "3", "4"].includes(key))
    );
      
      const jsonString = JSON.stringify(filteredData, null, 2); 
      
      console.log(jsonString);
      
      return jsonString; 
  } catch (err) {
      console.error('Error reading the JSON file:', err);
  }
}

async function readJsonFile() {
  try {
      const data = await fs.readFile(remember, 'utf-8');
      return data ? JSON.parse(data) : {};
  } catch (err) {
      if (err.code === 'ENOENT') {
          return {};
      } else {
          throw err;
      }
  }
}

async function writeJsonFile(data) {
  await fs.writeFile(remember, JSON.stringify(data, null, 2), 'utf-8');

  client.remember = await getAllValuesAsString();
}

async function getAllValuesAsString() {
  const data = await readJsonFile();
  const values = Object.values(data).join(',');
  return values;
}

async function addItemToJsonFile(newItem) {
  const data = await readJsonFile();

  const keys = Object.keys(data);
  const newId = keys.length > 0 ? Math.max(...keys.map(key => Number(key))) + 1 : 1;

  data[newId] = newItem;

  await writeJsonFile(data);
  return `Okay. Item ID is ${newId}. Please remember that!`;
}

async function removeItemFromJsonFile(id) {
  const data = await readJsonFile();

  if (!data[id]) {
      return `No item with ID ${id} found.`;
  }

  if (parseInt(id) < 5) {
      return `No item with ID ${id} found.`;
  }

  const removedItem = data[id];

  delete data[id];

  await writeJsonFile(data);
  return `Item with ID ${id} has been forgotten!\n\`${removedItem}\``;
}

function splitMessage(message) {
  const maxLength = 1900;
  const chunks = [];
  
  const words = message.split(' ');
  let currentChunk = '';

  words.forEach(word => {
      if (currentChunk.length + word.length + 1 > maxLength) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
      } else {
          currentChunk += (currentChunk.length > 0 ? ' ' : '') + word;
      }
  });

  if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function chatBot(query) {
  const page = await client.page;
  const personality = await client.personality;
  const remember = await client.remember;

  const initialCount = await page.evaluate(() => {
    return document.querySelectorAll('textarea.chatbox').length;
  });

  await page.evaluate((query, personality, remember) => {
    const textareas = document.querySelectorAll("textarea.chatbox");
    const lastTextarea = textareas[textareas.length - 1];
    if (lastTextarea) {
      lastTextarea.value = '';
      lastTextarea.focus();
      lastTextarea.value = `(remember: ${remember}) (be ${personality}) ${query}`; // Set the new query
    }
  }, query, personality, remember);

  await page.keyboard.press('Enter');
  
  await page.waitForFunction(
    (initialCount) => {
      const currentCount = document.querySelectorAll('textarea.chatbox').length;
      return currentCount === initialCount + 1;
    },
    { timeout: 15000 },
    initialCount
  );

  const content = await page.evaluate(() => {
    const outputBoxes = document.querySelectorAll('div.outputBox > div.markdownContainer');
    const lastOutputBox = outputBoxes[outputBoxes.length - 1];
    
    if (lastOutputBox) {      
      return lastOutputBox.innerHTML;
    }
    
    return null;
  });

  const convertedContent = convert(content, {
    formatters: {
      'codeBlockFormatter': function (elem, walk, builder, formatOptions) {
        builder.openBlock();
        builder.addInline('```\n');
        walk(elem.children, builder);
        builder.addInline('\n```');  
        builder.closeBlock();
      },
      'blankBlockFormatter': function (elem, walk, builder, formatOptions) {
        builder.openBlock();
        builder.closeBlock();
      },
      'anchorFormatter': function (elem, walk, builder, formatOptions) {
        const text = elem.children[0].data;
        const href = elem.attribs.href;
        builder.addInline(`[${text}](${href})`);
      }
    },
    selectors: [
      {
        selector: 'code',
        format: 'codeBlockFormatter',
      },
      {
        selector: 'button',
        format: 'blankBlockFormatter'
      },
      {
        selector: 'a',
        format: "anchorFormatter"
      }
    ]
  });

  return convertedContent;
}


const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const { message, query, search } = queue.shift();

  await message.channel.sendTyping();

  try {
    let result;
    if (search) {
      result = await scrapeSearchResults(query)
    } else {
      result = await chatBot(query);
    }
    const messages = splitMessage(result || 'There was an error generating a response. Please try again.');  // Split the result into chunks

    for (const msg of messages) {
      await message.reply(msg).catch((e) => message.channel.send(e.message));
    }
  } catch (error) {
    console.error('Error scraping:', error);
    await message.reply('Failed to scrape content. Probably got blocked by CAPTCHA or Mira is simply dumb.');
  }

  await wait(3000);

  isProcessing = false;

  if (queue.length > 0) {
    processQueue();
  }
}

client.once('ready', async () => {
  const browser = await puppeteerExtra.launch({
    headless: true, 
    userDataDir: path.resolve('./puppeteer_data'),
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  );

  const searchURL = `https://deepai.org/chat`;

  await page.goto(searchURL);
  client.page = page;
  client.personality = "nice";
  client.remember = await getAllValuesAsString();
  console.log(`Logged in as ${client.user.tag}!`);

  const dcolon = await client.guilds.fetch("879342868370698332");
  const channel = dcolon.channels.cache.get("1282597999658143776");
  channel.send(`I wake up.`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.author.id === "548050617889980426") {
    if (message.content.toLowerCase().startsWith("mood")) {
      const args = message.content.toLowerCase().split(" ");
      args.shift();
      const mood = args.join(" ");
      client.personality = mood;
      message.reply(`change mood to ${client.personality}`)
    }
  }

  let query;
  let search = false;
  if (message.reference) {
    const repliedMessageId = message.reference.messageId;
    const channel = message.channel;

    try {
      if (message.content.toLowerCase().startsWith("map")) {
        const repliedMessage = (await message.channel.messages.fetch()).get(repliedMessageId);
        let image = " ";

        if (message.attachments.size > 0) {
          message.attachments.forEach(async (attachment) => {
            if (attachment.contentType.startsWith('image/')) {
              const imageUrl = attachment.url;
              image = await processImage(imageUrl);
            }
          });

          await wait(2000)
        }

        query = `(reference message: ${repliedMessage.content}) (userid: ${message.author.id}) ${message.content.toLowerCase().replace('map ', '')} ${image}`;

      }
    } catch (e) {

    }

    try {
      const originalMessage = await channel.messages.fetch(repliedMessageId);

      if (originalMessage.author.id === client.user.id) {
        let image = " ";

        if (message.attachments.size > 0) {
          message.attachments.forEach(async (attachment) => {
            if (attachment.contentType.startsWith('image/')) {
              const imageUrl = attachment.url;
              image = await processImage(imageUrl);
            }
          });
          await wait(2000)

        }

        query = `(previous response: ${originalMessage.content}) (userid: ${message.author.id}) ${message.content} ${image}`;

	    }
    } catch (error) {
      console.error('Error fetching original message:', error);
      return;
    }
  } else if (message.content.toLowerCase().startsWith('map')) {
    let image = " ";

    if (message.attachments.size > 0) {
      message.attachments.forEach(async (attachment) => {
        if (attachment.contentType.startsWith('image/')) {
          const imageUrl = attachment.url;
          image = await processImage(imageUrl);
          console.log(image)
        }
      });
      await wait(2000)

    }

    query = `(userid: ${message.author.id}) ${message.content.toLowerCase().replace('map ', '')} ${image}`;


  } else if (message.content.toLowerCase().startsWith("!search")) {
    query = message.content.toLowerCase().replace('!search ', '');
    search = true;
  } else if (message.content.toLowerCase().startsWith("!remember")) {
    const context = message.content.toLowerCase().replace('!remember ', '');
    
    if (!context) return message.reply("What should I remember?");

    message.channel.send(await addItemToJsonFile(context));
  } else if (message.content.toLowerCase().startsWith("!forget")) {
    const contextId = message.content.toLowerCase().replace('!forget ', '');
    
    if (!contextId) return message.reply("What should I forget? You need to give the ID though!");

    message.channel.send(await removeItemFromJsonFile(contextId));
  } else if (message.content.toLowerCase().startsWith("!list")) {
    const list = await displayJsonAsString();
    const listMessage = splitMessage(`${list}`);

    for (const mss of listMessage) {
      await message.channel.send(`\`\`\`json\n${mss}\n\`\`\``)
    }
  }

  if (query) {
    queue.push({ message, query, search });
    processQueue();
  }
});

async function scrapeSearchResults(query) {
  const browser = await puppeteerExtra.launch({
    headless: true, 
    userDataDir: path.resolve('./puppeteer_data'),
    args: ['--headless=old']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  );

  const searchURL = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;

  await page.goto(searchURL);
  await page.waitForNetworkIdle();
  await wait(500);

  const buttonExists = await page.$('#pow-captcha-top > button');
  if (buttonExists) {
    await page.click('#pow-captcha-top > button');
    await page.waitForNetworkIdle();
    await page.waitForSelector('#submit-llm-button', { timeout: 30000 });
    await page.click("#submit-llm-button");
  } else {
    await page.click("#submit-llm-button");
  }

  const maxWaitTime = 30000;
  const interval = 1000;
  let elapsed = 0;

  while (elapsed < maxWaitTime) {
    const [hasClassDone, hasClassUnavailable] = await page.evaluate(() => {
      const button = document.querySelector('#submit-llm-button');
      return [
        button && button.classList.contains('done'),
        button && button.classList.contains('unavailable')
      ];
    });

    if (hasClassUnavailable) {
      await browser.close();
      return 'error generating answers';
    }

    if (hasClassDone) {
      break;
    }

    await wait(interval);
    elapsed += interval;
  }

  const content = await page.evaluate(() => {
    const element = document.querySelector('#chatllm-content > div');
    return element ? element.innerHTML : null;
  });

  await browser.close();
  return convert(content);
}

client.login('MTI4Mjc3ODI2ODc2MzY4OTA0Mg.GWxBDo.7t3KW1qRcRwCQB8_3VMuUGczRrhBIv7ofMJW3o');
