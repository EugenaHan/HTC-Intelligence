#!/usr/bin/env node
/**
 * 宏观经济爬虫
 * 专门用于抓取宏观经济数据 (PBOC, NBS, AAStocks)
 * 强制打上 Macro Economy 标签
 * Run: node api/cron_economy.js
 */
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const cheerio = require('cheerio');
const { saveNews, connectToDatabase } = require('./db');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;

const SOURCE = {
  name: 'China Economic Data',
  // 定向搜索：统计局、央行、阿思达克，以及核心经济指标
  url: 'https://www.bing.com/news/search?q=(China+CPI+OR+GDP+OR+RMB+exchange+rate+OR+inflation+OR+PBOC+interest+rate)+site:stats.gov.cn+OR+site:pbc.gov.cn+OR+site:aastocks.com+OR+site:chinadaily.com.cn/business&format=rss&cc=US&setLang=en-US',
  type: 'rss'
};

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

async function start() {
  console.log("🚀 Starting Economy Crawler...");
  await connectToDatabase();

  try {
    console.log(`📡 Fetching: ${SOURCE.name}`);
    const res = await axios.get(SOURCE.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      },
      timeout: 30000
    });

    const $ = cheerio.load(res.data, { xmlMode: true });

    const items = $('item').slice(0, 10).map((i, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text();
      const summary = $(el).find('description').text().replace(/<[^>]+>/g, '').trim();

      return {
        title,
        url: link,
        summary,
        date: new Date(pubDate).toISOString(),
        source: SOURCE.name
      };
    }).get();

    console.log(`   ✅ Found ${items.length} articles`);

    let count = 0;
    for (const item of items) {
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
  } catch (e) {
    console.error('Economy Crawler Error:', e.message);
  }

  process.exit(0);
}

start().catch(err => {
  console.error('\n💥 程序异常:', err);
  process.exit(1);
});
