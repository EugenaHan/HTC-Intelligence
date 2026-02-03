#!/usr/bin/env node
/**
 * 降级增效：混合爬取模式，优先保障数据量，DeepSeek 洞察 + Fallback，环境适配（证书 / Node）。
 * Run: node api/cron.js (from htc-intelligence directory)
 */
const axios = require('axios');
const cheerio = require('cheerio');

// 关键修复 1：解决部分中文网站证书报错问题
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;

// 混合关键词：中文 + 英文，扩大捕获面
const KEYWORDS = ['China outbound', 'Chinese tourists', 'US visa', 'Hawaii tourism', '中美直航', '出境游趋势', '美国签证', '夏威夷旅游'];

// 动态时间窗口：仅接受当月和上个月的新闻
function isRecentEnough(dateString) {
  if (!dateString) return false;
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const pubDate = new Date(dateString);
  if (isNaN(pubDate.getTime())) return false;
  const m = pubDate.getMonth();
  const y = pubDate.getFullYear();
  if (y === currentYear && m === currentMonth) return true;
  if (y === lastMonthYear && m === lastMonth) return true;
  return false;
}

// 核心配置：精简信源；RSS 使用 when:60d 仅取近两月
const NEWS_SOURCES = [
  {
    name: 'Google News RSS (Global)',
    searchUrl: 'https://news.google.com/rss/search?q=Hawaii+tourism+China+outbound+when:60d&hl=en-US&gl=US&ceid=US:en',
    isRSS: true
  },
  {
    name: 'Travel And Tour World',
    baseUrl: 'https://www.travelandtourworld.com',
    searchUrl: 'https://www.travelandtourworld.com/news/',
    selectors: { articles: 'article.post', title: 'h2.entry-title a', link: 'h2.entry-title a', summary: '.entry-content p' }
  },
  {
    name: 'Dragon Trail',
    baseUrl: 'https://www.dragontrail.com',
    searchUrl: 'https://www.dragontrail.com/resources/blog',
    selectors: { articles: '.blog-post', title: 'h2 a', link: 'h2 a', summary: '.excerpt' }
  }
];

// AI 洞察 + 情感：DeepSeek 返回 sentiment（利好/中立/威胁）与 insight
async function generateInsightAndSentiment(title, summary) {
  const fallback = { insight: "请配置 API Key 以获取 AI 洞察。", sentiment: "中立" };
  if (!DEEPSEEK_KEY) return fallback;

  const prompt = `你是一位夏威夷旅游局（HTB）的战略顾问。分析这篇新闻对夏威夷旅游市场的影响。
标题：${title}
摘要：${summary}

请严格按以下格式回复，不要添加其他内容：
第一行：情感（只能是以下三者之一）利好 或 中立 或 威胁
第二行：50字以内的专业中文洞察`;

  try {
    const res = await axios.post(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      timeout: 15000
    });
    const raw = res.data?.choices?.[0]?.message?.content?.trim() || "";
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    let sentiment = "中立";
    if (lines[0]) {
      const first = lines[0].replace(/[。.]+$/, "").trim();
      if (first === "利好" || first === "中立" || first === "威胁") sentiment = first;
      else if (lines[0].includes("利好")) sentiment = "利好";
      else if (lines[0].includes("威胁")) sentiment = "威胁";
    }
    const insight = lines[1] || raw || "分析暂无结果";
    return { insight, sentiment };
  } catch (err) {
    return { insight: "AI 分析暂不可用，请稍后查看。", sentiment: "中立" };
  }
}

async function crawlRSS(source) {
  console.log(`📡 Fetching RSS: ${source.name}`);
  try {
    const res = await axios.get(source.searchUrl);
    const $ = cheerio.load(res.data, { xmlMode: true });
    const articles = [];
    $('item').each((i, el) => {
      if (i < 10) {
        articles.push({
          title: $(el).find('title').text(),
          url: $(el).find('link').text(),
          summary: $(el).find('description').text().substring(0, 200),
          source: source.name,
          date: new Date($(el).find('pubDate').text()).toISOString().split('T')[0]
        });
      }
    });
    return articles;
  } catch (e) {
    console.error(`RSS Error: ${e.message}`);
    return [];
  }
}

async function crawlWeb(source) {
  console.log(`🕷️ Crawling Web: ${source.name}`);
  try {
    const res = await axios.get(source.searchUrl, { timeout: 15000 });
    const $ = cheerio.load(res.data);
    const articles = [];
    $(source.selectors.articles).each((i, el) => {
      const title = $(el).find(source.selectors.title).text().trim();
      const link = $(el).find(source.selectors.link).attr('href');
      const summary = $(el).find(source.selectors.summary).text().trim();
      if (title && link) {
        articles.push({
          title,
          url: link.startsWith('http') ? link : (source.baseUrl || '') + link,
          summary: summary.substring(0, 300),
          source: source.name,
          date: new Date().toISOString().split('T')[0]
        });
      }
    });
    return articles;
  } catch (e) {
    console.error(`Web Error: ${e.message}`);
    return [];
  }
}

async function crawlAll() {
  let allNews = [];
  for (const src of NEWS_SOURCES) {
    const news = src.isRSS ? await crawlRSS(src) : await crawlWeb(src);
    allNews.push(...news);
  }

  // 1. 过滤：关键词 + 动态时间窗口（仅当月和上个月）
  const filtered = allNews.filter(n =>
    KEYWORDS.some(kw => (n.title + n.summary).toLowerCase().includes(kw.toLowerCase())) && isRecentEnough(n.date)
  );

  console.log(`✅ Total articles after filtering (keyword + date): ${filtered.length}`);

  const API_URL = process.env.API_URL || 'http://localhost:3000/api';

  // 2. 为过滤后的新闻生成 AI 洞察与情感并推送
  for (const item of filtered) {
    console.log(`🤖 Generating Insight + Sentiment for: ${item.title}`);
    const { insight, sentiment } = await generateInsightAndSentiment(item.title, item.summary);
    item.insight = insight;
    item.sentiment = sentiment;
    item.month = item.date ? item.date.substring(0, 7).replace('-', '年') + '月' : new Date().toISOString().slice(0, 7).replace('-', '年') + '月';
    item.categories = item.categories || ['Market Trend'];

    // 3. 推送到 API / MongoDB
    try {
      await axios.post(`${API_URL}/news`, item, { headers: { 'Content-Type': 'application/json' } });
      console.log('Successfully pushed to MongoDB:', item.title);
    } catch (e) {
      console.error(`Save Error: ${e.message}`);
    }
  }
}

crawlAll()
  .then(() => {
    console.log('Cron crawl completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Cron crawl failed:', err);
    process.exit(1);
  });
