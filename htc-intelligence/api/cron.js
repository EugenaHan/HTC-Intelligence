#!/usr/bin/env node
/**
 * Cron entrypoint for Daily Market Intelligence Crawl.
 * Run with: node api/cron.js (from htc-intelligence directory)
 * Includes: Level 2 deep crawl (detail page + articleBody, fullText 1500 chars) and DeepSeek dynamic insight.
 * Used by GitHub Actions; runs in headless environment (axios + cheerio only, no browser).
 */
// Polyfill for ReferenceError: File is not defined (e.g. in some GitHub Actions / Node envs)
try {
  const { File } = require('undici');
  if (!global.File) global.File = File;
} catch (_) {}

const { crawlAllNews } = require('../crawler/news-crawler');

crawlAllNews()
  .then(() => {
    console.log('Cron crawl completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Cron crawl failed:', err);
    process.exit(1);
  });
