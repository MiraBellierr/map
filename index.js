const puppeteer = require("puppeteer");
const natural = require("natural");
const tokenizer = new natural.WordTokenizer();
const sentenceTokenizer = new natural.SentenceTokenizer();

async function scrapeSearchResults(query) {
	const browser = await puppeteer.launch({ headless: false });
	const page = await browser.newPage();
	const searchURL = `https://search.brave.com/search?q=${encodeURIComponent(
		query
	)}`;

	await page.goto(searchURL);

	// Wait for search results to load
	await page.waitForSelector("#results");

	// Scrape the top 3 results
	const results = await page.evaluate(() => {
		return Array.from(
			document.querySelectorAll("#results > div.snippet:not(.standalone)")
		)
			.slice(0, 3) // Only take the top 3 results
			.map((result) => {
				const title = result.querySelector(".title").title;
				const link = result.querySelector("a").href;
				return { title, link };
			});
	});

	await browser.close();
	return results;
}

async function scrapePageContent(url) {
	const browser = await puppeteer.launch({ headless: false });
	const page = await browser.newPage();

	await page.goto(url, { waitUntil: "domcontentloaded" });

	// Extract text content from the page
	const content = await page.evaluate(() => {
		// Extract the main content of the page, you might need to adjust the selectors based on the site structure
		return document.body.innerText;
	});

	await browser.close();
	return content;
}

function tokenizeTextIntoSentences(text) {
	// Tokenize the content into sentences
	const sentences = sentenceTokenizer.tokenize(text);
	return sentences;
}

function calculateRelevance(query, sentence) {
	const queryTokens = new Set(tokenizer.tokenize(query.toLowerCase()));
	const sentenceTokens = new Set(tokenizer.tokenize(sentence.toLowerCase()));

	// Calculate the overlap between query and sentence tokens
	let commonWords = [...queryTokens].filter((word) => sentenceTokens.has(word));
	return commonWords.length;
}

function getMostRelevantSentences(query, sentences) {
	// Calculate relevance score for each sentence
	const relevanceScores = sentences.map((sentence) => ({
		sentence,
		score: calculateRelevance(query, sentence),
	}));

	// Filter and sort by relevance score (highest to lowest)
	const relevantSentences = relevanceScores
		.filter((result) => result.score > 2) // Keep sentences with some relevance
		.sort((a, b) => b.score - a.score); // Sort by relevance score

	return relevantSentences.map((result) => result.sentence);
}

function makeNaturalLanguageSummary(relevantSentences) {
	// Simple way to concatenate relevant sentences into a readable paragraph
	if (relevantSentences.length === 0) {
		return "No relevant content found.";
	}

	// Combine the most relevant sentences
	const summary = relevantSentences.join(" ");
	// Simple replacement or connection logic (you can add more)
	const enhancedSummary = summary.replace(/\. /g, ". Furthermore, ");

	return enhancedSummary;
}

async function main(query) {
	const searchResults = await scrapeSearchResults(query);

	// For each result, scrape the content, tokenize it, and find relevant sentences
	for (const result of searchResults) {
		console.log(`Scraping content from: ${result.title} (${result.link})`);
		const pageContent = await scrapePageContent(result.link);
		const sentences = tokenizeTextIntoSentences(pageContent);
		const relevantSentences = getMostRelevantSentences(query, sentences);
		const naturalSummary = makeNaturalLanguageSummary(relevantSentences);

		console.log({
			title: result.title,
			url: result.link,
			naturalSummary, // A readable summary
		});
	}
}

main("Why cats are so cute?");
