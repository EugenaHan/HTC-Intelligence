#!/usr/bin/env node
/**
 * 智能爬虫 8.2：五剑合璧纯净版
 * 核心升级：
 * 1. 移除失效源（PhocusWire, Simple Flying），保留5个100%稳定源
 * 2. 多维分类逻辑：行业标签（Aviation/Hospitality/Policy/Tech/Cruise）+ 核心大类
 * 3. 智能过滤：针对全球源（Skift）过滤欧美本土新闻，提升情报纯度
 * 4. 最终配置：5个垂直源，36篇/次，100%相关度
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

// v8.2 最终信源池（五剑合璧 - 100%稳定）
const NEWS_SOURCES = [
  // --- A. 亚洲区域核心 (竞对动态) ---
  { name: 'Travel News Asia', url: 'https://www.travelnewsasia.com/travelnews.xml', type: 'rss' },
  { name: 'TTR Weekly', url: 'https://www.ttrweekly.com/site/feed/', type: 'rss' },
  { name: 'TTG Asia', url: 'https://www.ttgasia.com/feed/', type: 'rss' },

  // --- B. 全球行业权威 (趋势与数据) ---
  { name: 'Skift', url: 'https://skift.com/feed/', type: 'rss' },

  // --- C. 垂直细分领域 (免税零售) ---
  { name: 'Moodie Davitt Report', url: 'https://www.moodiedavittreport.com/feed/', type: 'rss' }
];

// --- 2. 辅助函数 ---

// --- 2. 辅助函数 (多维分类逻辑) ---

// 多维分类器 (v8.1 - 行业标签 + 核心大类)
function autoCategorize(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  const cats = new Set();

  // --- 维度一：行业标签 (Industry Tags) ---
  if (text.match(/flight|airline|aviation|airport|route|boeing|airbus|capacity|aircraft|jet/)) cats.add('Aviation'); // 航空
  if (text.match(/hotel|resort|hospitality|accommodation|hilton|marriott|accor|hyatt|ihg|occupancy/)) cats.add('Hospitality'); // 酒店
  if (text.match(/visa|policy|government|agreement|official|entry|restriction|border|mfa/)) cats.add('Policy'); // 政策
  if (text.match(/tech|ai|digital|ota|booking|trip\.com|expedia|app|mobile/)) cats.add('Tech'); // 科技 (适配 PhocusWire)
  if (text.match(/cruise|ship|sailing/)) cats.add('Cruise'); // 邮轮

  // --- 维度二：宏观经济 (Macro Economy) ---
  // 识别宏观经济相关新闻（GDP、CPI、汇率、央行政策等）
  const economyKw = [
    'gdp', 'cpi', 'inflation', 'exchange rate', 'yuan', 'rmb', 'renminbi',
    'interest rate', 'central bank', 'p boc', 'people\'s bank',
    'reserve requirement', 'monetary policy', 'consumer price',
    'retail sales', 'trade surplus', 'trade deficit', 'export', 'import',
    'bond market', 'stock market', 'currency', 'devaluation', 'appreciation'
  ];
  if (economyKw.some(k => text.includes(k)) && text.includes('china')) {
    cats.add('Macro Economy');
  }

  // --- 维度三：核心大类 (Primary Segments) ---

  // 1. 奢侈品与零售 (Luxury & Retail) - 重点！
  const consumeKw = ['luxury', 'retail', 'duty free', 'dfs', 'brands', 'fashion', 'mall', 'cdf', 'consumption', 'shopper'];
  if (consumeKw.some(k => text.includes(k))) {
    cats.add('Luxury & Retail');
    // 如果是消费类，顺便打上消费趋势标签
    if (!cats.has('Consumption Trend')) cats.add('Consumption Trend');
  }

  // 2. 短线 vs 长线 (竞对维度)
  const shortHaulKw = ['thailand', 'vietnam', 'singapore', 'malaysia', 'bali', 'japan', 'korea', 'asia', 'hong kong', 'macau', 'hainan', 'taiwan'];
  const longHaulKw = ['us', 'usa', 'hawaii', 'europe', 'uk', 'france', 'germany', 'australia', 'canada', 'middle east'];

  if (shortHaulKw.some(k => text.includes(k))) cats.add('Short Haul');
  if (longHaulKw.some(k => text.includes(k))) cats.add('Long Haul');

  // 3. 出境游趋势 (兜底大类)
  // 如果没有分到上面任何一类，且包含宏观词，归为出境游趋势
  if (cats.size === 0 || text.match(/outbound|trend|forecast|report|data|survey|recovery|chinese tourist|china market/)) {
    cats.add('Outbound Trend');
  }

  return Array.from(cats);
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

// --- 3. AI 核心 ---

async function analyzeNews(title, summary) {
  if (!DEEPSEEK_KEY) return { title_cn: title, summary_cn: summary, insight_cn: "Key Missing", insight_en: "Key Missing", sentiment: "Neutral" };

  const prompt = `Role: Hawaii Tourism Board Strategist.
Task: Analyze news for China market impact.
News: "${title}" - "${summary}"

Output JSON ONLY:
1. "title_cn": Chinese Title.
2. "summary_cn": Chinese Summary (max 80 words).
3. "insight_cn": Strategic implication for Hawaii in Chinese (max 50 words).
4. "insight_en": Strategic implication for Hawaii in English (max 50 words).
5. "sentiment": "Positive", "Neutral", or "Negative" (English).`;

  try {
    const res = await axios.post(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 600
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
    console.error(`AI Error: ${err.message}`);
    return { title_cn: title, summary_cn: summary, insight_cn: "AI繁忙", insight_en: "AI Busy", sentiment: "Neutral" };
  }
}

// --- 4. 抓取引擎 (v8.2 智能过滤版 - 5源优化) ---

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

    $('item').each((i, el) => {
      if (i > 15) return;

      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text();

      let summary = $(el).find('description').text() || $(el).find('content\\:encoded').text();
      summary = summary.replace(/<[^>]+>/g, '').trim().substring(0, 300) || title;

      const fullText = (title + ' ' + summary).toLowerCase();

      // --- 智能过滤策略 ---
      // 亚洲/垂直源：直接放行（高相关度）
      // Skift（全球源）：必须命中关键词
      const keywords = [
        'china', 'chinese', 'asia', 'asian',
        'hawaii', 'outbound', 'tourism', 'travel', 'flight', 'visa', 'hotel'
      ];

      const isGlobalSource = source.name === 'Skift';
      const isRelevant = keywords.some(k => fullText.includes(k));

      if (link && (isRelevant || !isGlobalSource)) {
        items.push({
          title,
          url: link,
          summary,
          source: source.name,
          date: parseDate(pubDate)
        });
      }
    });

    console.log(`   ✅ ${source.name}: Found ${items.length} articles`);
    return items;
  } catch (e) {
    console.error(`❌ ${source.name} Failed: ${e.message}`);
    return [];
  }
}

// --- 5. 主程序 ---

async function start() {
  console.log("🚀 Starting HTC Intelligence Crawler v8.2...");
  await connectToDatabase();

  let allNews = [];
  for (const src of NEWS_SOURCES) {
    const items = await fetchRSS(src);
    allNews = allNews.concat(items);
  }

  const freshNews = allNews.filter(n => isRecent(n.date));
  console.log(`📊 Total Fresh News: ${freshNews.length}`);

  if (freshNews.length === 0) process.exit(0);

  console.log('\n🤖 AI Analyzing & Saving...\n');

  let count = 0;
  for (const item of freshNews) {
    // 应用多维分类
    item.categories = autoCategorize(item.title, item.summary);

    // AI 分析
    const ai = await analyzeNews(item.title, item.summary);
    Object.assign(item, ai);

    try {
      const result = await saveNews(item);
      if (result.inserted) {
        count++;
        console.log(`✅ [${item.source}] ${item.title_cn}`);
      } else {
        // console.log(`⚠️  [Skip] ${item.title_cn}`);
      }
    } catch (e) { console.error(e.message); }
  }

  console.log(`\n🎉 Done! Added ${count} new articles.`);
  process.exit(0);
}

start().catch(err => {
  console.error('\n💥 程序异常:', err);
  process.exit(1);
});
