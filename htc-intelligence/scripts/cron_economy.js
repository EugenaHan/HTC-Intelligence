#!/usr/bin/env node
/**
 * 宏观经济爬虫
 * 专门用于抓取宏观经济数据
 * 强制打上 Macro Economy 标签
 * Run: node scripts/cron_economy.js
 */
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const cheerio = require('cheerio');
const { saveNews, connectToDatabase } = require('../lib/db');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;

// 使用可靠的 RSS 源
const NEWS_SOURCES = [
  {
    name: 'South China Morning Post - Economy',
    url: 'https://www.scmp.com/rss/91/feed',
    type: 'rss'
  },
  {
    name: 'BBC Business',
    url: 'http://feeds.bbci.co.uk/news/business/rss.xml',
    type: 'rss'
  },
  {
    name: 'Google News - China Economy',
    url: 'https://news.google.com/rss/search?q=China+economy+GDP+CPI+inflation+exchange+rate&hl=en-US&gl=US&ceid=US:en',
    type: 'rss'
  }
];

// 经济关键词过滤器
function isEconomyRelated(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  const economyKeywords = [
    'gdp', 'cpi', 'inflation', 'exchange rate', 'yuan', 'rmb',
    'interest rate', 'central bank', 'p boc', 'economy', 'economic',
    'market', 'stock', 'bond', 'currency', 'trade', 'import', 'export',
    'china', 'chinese', 'consumer spending', 'retail sales', 'hong kong'
  ];
  return economyKeywords.some(k => text.includes(k));
}

// 经济学家 AI：只关注数字和趋势
async function analyzeEconomy(title, summary) {
  if (!DEEPSEEK_KEY) {
    return {
      title_cn: title,
      summary_cn: summary,
      insight_cn: "数据缺失",
      insight_en: "Data Missing",
      sentiment: "Neutral"
    };
  }

  const prompt = `Role: Chief Economist.
Task: Analyze this economic news for its impact on Chinese consumer spending power.
News: "${title}" - "${summary}"

Output JSON ONLY:
1. "title_cn": Chinese Title.
2. "summary_cn": Chinese Summary (max 80 words).
3. "insight_cn": Impact on Chinese travel spending in Chinese (max 50 words).
4. "insight_en": Impact on Chinese travel spending in English (max 50 words).
5. "sentiment": "Positive" (spending up), "Neutral" (stable), or "Negative" (spending down).`;

  try {
    const res = await axios.post(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      timeout: 60000
    });

    return JSON.parse(res.data.choices[0].message.content);
  } catch (err) {
    console.error(`AI Error: ${err.message}`);
    return {
      title_cn: title,
      summary_cn: summary,
      insight_cn: "分析中...",
      insight_en: "Analyzing...",
      sentiment: "Neutral"
    };
  }
}

async function fetchRSS(source) {
  console.log(`📡 Fetching: ${source.name}`);
  try {
    const res = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      },
      timeout: 30000
    });

    const $ = cheerio.load(res.data, { xmlMode: true });
    const items = [];

    $('item').slice(0, 15).each((i, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text();
      let summary = $(el).find('description').text() || $(el).find('content\\:encoded').text();
      summary = summary.replace(/<[^>]+>/g, '').trim().substring(0, 300) || title;

      // 只保留经济相关的新闻
      if (link && isEconomyRelated(title, summary)) {
        items.push({
          title,
          url: link,
          summary,
          date: new Date(pubDate).toISOString(),
          source: source.name
        });
      }
    });

    console.log(`   ✅ ${source.name}: Found ${items.length} economy articles`);
    return items;
  } catch (e) {
    console.error(`   ❌ ${source.name} Failed: ${e.message}`);
    return [];
  }
}

async function start() {
  console.log("🚀 Starting Economy Crawler...");
  await connectToDatabase();

  let allNews = [];
  for (const src of NEWS_SOURCES) {
    const items = await fetchRSS(src);
    allNews = allNews.concat(items);
  }

  console.log(`📊 Total Economy News: ${allNews.length}`);

  if (allNews.length === 0) {
    console.log('⚠️  No economy articles found.');
    process.exit(0);
  }

  let count = 0;
  for (const item of allNews) {
    // 强制打上 Macro Economy 标签
    item.categories = ['Macro Economy'];

    const ai = await analyzeEconomy(item.title, item.summary);
    Object.assign(item, ai);

    try {
      const result = await saveNews(item);
      if (result.inserted) {
        count++;
        console.log(`💰 [Economy] ${item.title_cn}`);
      }
    } catch (e) {
      console.error(e.message);
    }
  }

  console.log(`\n🎉 Done! Added ${count} new economy articles.`);
  process.exit(0);
}

start().catch(err => {
  console.error('\n💥 程序异常:', err);
  process.exit(1);
});
