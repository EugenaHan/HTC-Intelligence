#!/usr/bin/env node
/**
 * 智能爬虫 5.0：双语内核版
 * 功能：抓取 RSS -> AI 生成中英双语标题、摘要、洞察 -> 存入 MongoDB
 * Run: node api/cron.js
 */
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const cheerio = require('cheerio');
const { saveNews, connectToDatabase } = require('./db');

// 环境适配
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const DEEPSEEK_BASE = (process.env.API_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const DEEPSEEK_KEY = process.env.OPENAI_API_KEY;

// --- 1. 配置中心 ---

// 时间窗口：90天 (本月 + 上月 + 上上月)
const DATE_WINDOW_DAYS = 90;

// 稳定信源池 (全部使用 RSS，避免 404 和反爬)
const NEWS_SOURCES = [
  {
    name: 'Google News (China Outbound)',
    // 中国出境游 + 航线 + 签证新闻（增加超时和重试）
    url: 'https://news.google.com/rss/search?q=China+outbound+tourism+OR+Chinese+traveler+OR+US+China+flights+when:30d&hl=en-US&gl=US&ceid=US:en',
    type: 'rss'
  },
  {
    name: 'TTR Weekly (SE Asia Competition)',
    // 东南亚（短线）竞争对手动态
    url: 'https://www.ttrweekly.com/site/feed/',
    type: 'rss'
  },
  {
    name: 'Skift (Global Trends)',
    // 全球大趋势
    url: 'https://skift.com/feed/',
    type: 'rss'
  }
];

// --- 2. 辅助函数 ---

// 自动分类器
function autoCategorize(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();

  const shortHaulKw = ['china', 'japan', 'korea', 'thailand', 'vietnam', 'singapore', 'malaysia', 'bali', 'asia'];
  const longHaulKw = ['us', 'usa', 'united states', 'hawaii', 'europe', 'uk', 'france', 'germany', 'australia', 'canada'];
  const trendKw = ['luxury', 'spending', 'data', 'report', 'forecast', 'generation z', 'visa'];

  const categories = [];
  if (shortHaulKw.some(k => text.includes(k))) categories.push('Short Haul');
  if (longHaulKw.some(k => text.includes(k))) categories.push('Long Haul');
  if (trendKw.some(k => text.includes(k))) categories.push('消费趋势');

  // 默认兜底
  if (categories.length === 0) categories.push('Market Trend');
  return categories;
}

// 智能日期解析
function parseDate(dateString) {
  if (!dateString) return new Date().toISOString();
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// 时间过滤器 (90天窗口)
function isRecent(dateString) {
  if (!dateString) return true;
  const now = new Date();
  const pub = new Date(dateString);
  if (isNaN(pub.getTime())) return true; // 无法解析则保留

  const diffTime = Math.abs(now - pub);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= DATE_WINDOW_DAYS;
}

// --- 3. AI 分析核心 (双语版) ---

async function analyzeNews(title, summary) {
  if (!DEEPSEEK_KEY) {
    return {
      title_cn: title,
      summary_cn: summary,
      insight_cn: "AI Key Missing",
      insight_en: "AI Key Missing",
      sentiment: "Neutral"
    };
  }

  const prompt = `Role: Hawaii Tourism Board Analyst.
Task: Analyze this news for the China market.
News: "${title}" - "${summary}"

Output JSON ONLY with these fields:
1. "title_cn": Translate title to Chinese.
2. "summary_cn": Summarize news in Chinese (max 100 words).
3. "insight_cn": Strategic implication for Hawaii in Chinese (max 50 words).
4. "insight_en": Strategic implication for Hawaii in English (max 50 words).
5. "sentiment": "Positive", "Neutral", or "Negative" (Use English words).`;

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

    const json = JSON.parse(res.data.choices[0].message.content);
    return {
      title_cn: json.title_cn || title,
      summary_cn: json.summary_cn || summary,
      insight_cn: json.insight_cn || "分析中...",
      insight_en: json.insight_en || "Analysis pending...",
      sentiment: json.sentiment || "Neutral"
    };
  } catch (err) {
    console.error(`AI 分析失败: ${err.message}`);
    return {
      title_cn: title,
      summary_cn: summary,
      insight_cn: "AI繁忙",
      insight_en: "AI Busy",
      sentiment: "Neutral"
    };
  }
}

// --- 4. 抓取引擎 ---

async function fetchRSS(source) {
  console.log(`📡 请求源: ${source.name}`);
  try {
    // 伪装成浏览器，解决 Google News 超时问题
    const res = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive'
      },
      timeout: 20000,
      maxRedirects: 5
    });

    const $ = cheerio.load(res.data, { xmlMode: true });
    const items = [];

    $('item').each((i, el) => {
      if (i > 15) return; // 每个源限制15条

      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text();

      // 摘要清洗：去除 HTML 标签
      let summary = $(el).find('description').text() || $(el).find('content\\:encoded').text();
      summary = summary.replace(/<[^>]+>/g, '').trim().substring(0, 200) || title;

      // 关键词过滤：确保新闻和中国或旅游相关（减少噪音）
      const fullText = (title + ' ' + summary).toLowerCase();
      const keywords = ['china', 'chinese', 'tourism', 'travel', 'flight', 'visa', 'luxury', 'hotel', 'hawaii', 'asia', 'us', 'europe'];

      if (link && keywords.some(k => fullText.includes(k))) {
        items.push({
          title,
          url: link,
          summary,
          source: source.name,
          date: parseDate(pubDate)
        });
      }
    });

    console.log(`   ✅ ${source.name}: 提取 ${items.length} 篇文章`);
    return items;
  } catch (e) {
    console.error(`❌ ${source.name} 失败: ${e.message}`);
    return [];
  }
}

// --- 5. 主程序 ---

async function start() {
  console.log("🚀 启动智能情报中心 5.0 (双语内核版)...");

  // 连接数据库
  await connectToDatabase();
  console.log("✅ 数据库连接成功");

  let allNews = [];

  // 串行抓取所有源（避免并发问题）
  for (const src of NEWS_SOURCES) {
    const items = await fetchRSS(src);
    allNews = allNews.concat(items);
  }

  console.log(`\n📊 总共抓取 ${allNews.length} 篇文章`);

  // 时间过滤
  const freshNews = allNews.filter(n => isRecent(n.date));
  console.log(`📅 90天窗口内: ${freshNews.length} 篇文章`);

  if (freshNews.length === 0) {
    console.log('⚠️  没有符合条件的新闻');
    process.exit(0);
  }

  console.log('\n🤖 开始 AI 双语分析...\n');

  let successCount = 0;
  let failCount = 0;

  // 串行处理，避免 API 并发限制
  for (const item of freshNews) {
    // 1. 自动分类
    item.categories = autoCategorize(item.title, item.summary);

    // 2. AI 双语处理
    const ai = await analyzeNews(item.title, item.summary);
    item.title_cn = ai.title_cn;
    item.summary_cn = ai.summary_cn;
    item.insight_cn = ai.insight_cn;
    item.insight_en = ai.insight_en;
    item.sentiment = ai.sentiment;

    // 3. 入库
    try {
      const result = await saveNews(item);
      if (result.inserted) {
        successCount++;
        console.log(`✅ [${item.categories.join(', ')}] ${item.title_cn}`);
      } else {
        failCount++;
        console.log(`⚠️  ${item.title_cn} (已存在)`);
      }
    } catch (e) {
      failCount++;
      console.error(`❌ 入库失败: ${e.message}`);
    }
  }

  console.log(`\n📈 任务统计: 成功 ${successCount} 篇，失败/跳过 ${failCount} 篇`);
  console.log('\n🎉 智能情报中心 5.0 任务完成！');
  process.exit(0);
}

start().catch(err => {
  console.error('\n💥 程序异常:', err);
  process.exit(1);
});
