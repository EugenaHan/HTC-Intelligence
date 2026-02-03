const OpenAI = require('openai');
const { getNews, saveNews, getUserFavorites, addFavorite, removeFavorite, validateUser, connectToDatabase } = require('./db');

// DeepSeek / OpenAI 兼容：baseURL 未设置时默认 DeepSeek
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.API_BASE_URL || 'https://api.deepseek.com'
});

// 英文报告 System Prompt（与之前提供的 Prompt 一致）
const REPORT_SYSTEM_PROMPT = `You are a Senior Market Intelligence Consultant for the Hawaii Tourism Board (HTB) China Office. Your goal is to transform raw news data into a professional, English-language executive report.

Task: Analyze the user-selected news articles and generate a 2-section report in professional Business English.

**Section 1: Competitor Environment (Short-haul & Long-haul)**
Logic: Do not just summarize; analyze the Impact on Hawaii.

Sub-sections:
- **Short-haul (Asia/Pacific):** Focus on policy changes (visas), safety alerts (e.g., earthquakes), and new flight routes that might divert Chinese travelers away from Hawaii.
- **Long-haul (Australia/Europe/Americas):** Analyze how other long-haul destinations are "stealing the spotlight" through cultural events (e.g., Chopin Competition, Vivid Sydney) or aggressive airline expansion (e.g., Sichuan Airlines to LAX).

Style: Professional, objective, and data-driven. Use terms like "market diversion," "connectivity," and "competitive positioning."

**Section 2: Consumer and Travel Trends**
Logic: Identify shifts in who is traveling and how they are spending.

Key themes:
- Silver-haired Economy: Insights into the aging population's travel preferences.
- Event-driven Tourism: How concerts, festivals, and sports (e.g., EuroLeague) drive bookings.
- Quality & Self-driving: The shift towards high-star hotels and flexible itineraries.

Style: Insightful and forward-looking. Use terms like "demographic shift," "premiumization," and "experiential travel."

**Output requirements:**
- Language: Strictly Professional English. Even if the input news is in Chinese, output must be entirely in English.
- Formatting: Use Markdown with clear headers (##, ###) and bullet points.
- HTA Insight: For each major point, add a short "HTA Strategic Implication" (e.g., "Hawaii should emphasize its safety/stability vs. Japan" or "Hawaii should leverage its golf resources to target the rising silver-haired luxury segment").`;

module.exports = async function handler(req, res) {
  const url = req.url || '';
  const method = req.method || '';

  // 跨域 (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') return res.status(200).end();

  // path：Vercel 重写 /api/xxx -> /api?path=xxx，或从 URL 解析
  let path = (req.query && req.query.path) || null;
  if (!path && url) {
    const pathname = (url.split('?')[0] || '').replace(/^https?:\/\/[^/]+/, '');
    const m = pathname.match(/\/api\/([^?]+)/);
    if (m) path = m[1].replace(/\/$/, '');
    else if (url.includes('path=')) {
      const qs = url.split('?').pop() || '';
      const qm = qs.match(/path=([^&]*)/);
      path = qm ? decodeURIComponent(qm[1]) : null;
    }
  }

  const isNews = path === 'news' || url.includes('/api/news');
  const isLogin = path === 'login' || url.includes('/api/login');
  const isGenerateReport = path === 'generate-report' || url.includes('/api/generate-report');

  try {
    // 逻辑分流 A：获取新闻列表 (GET /api/news)
    if (isNews && method === 'GET') {
      const { segment, category, userId } = req.query || {};
      let filters = {};
      if (segment && segment !== 'all') filters.categories = { $in: [segment] };
      if (category && category !== 'all') filters.categories = { $in: [category] };
      const news = await getNews(filters);
      let favorites = [];
      if (userId) favorites = await getUserFavorites(userId);
      return res.status(200).json({
        success: true,
        data: news.map(item => ({
          ...item,
          isFavorite: favorites.includes(item._id.toString())
        })),
        count: news.length
      });
    }

    // 逻辑分流 B：用户登录 (POST /api/login)，支持 username/password 或 email/password
    if (isLogin && method === 'POST') {
      const body = req.body || {};
      const { username, email, password } = body;
      const loginId = username || email;
      if (!loginId || !password) {
        return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
      }
      const user = await validateUser(loginId, password);
      if (!user) {
        const db = await connectToDatabase();
        if (db) {
          const u = await db.collection('users').findOne(
            username ? { username, password } : { email: email || username, password }
          );
          if (u) {
            return res.status(200).json({
              success: true,
              user: {
                uid: u._id.toString(),
                email: u.email || u.username,
                name: u.username || u.email
              }
            });
          }
        }
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      return res.status(200).json({
        success: true,
        user: { uid: user.uid, email: user.email, name: user.email }
      });
    }

    // 逻辑分流 C：生成英文报告 (POST /api/generate-report)，接入 AI Prompt，返回 Markdown
    if (isGenerateReport && method === 'POST') {
      const body = req.body || {};
      const { selectedNews, news, authKey } = body;
      const articles = Array.isArray(selectedNews) ? selectedNews : (Array.isArray(news) ? news : []);

      if (authKey != null && authKey !== '' && process.env.CRON_SECRET && authKey !== process.env.CRON_SECRET) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      if (!articles.length) {
        return res.status(400).json({ success: false, message: 'Request must include non-empty "news" or "selectedNews" array.' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ success: false, message: 'OPENAI_API_KEY not configured.' });
      }

      const userMessage = `Generate the executive report based on the following selected news articles. Output only the report in Markdown.\n\n${JSON.stringify(articles, null, 2)}`;

      try {
        const completion = await openai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: REPORT_SYSTEM_PROMPT },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.4,
          max_tokens: 4096
        });
        const reportContent = (completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content)
          ? completion.choices[0].message.content.trim()
          : '';
        return res.status(200).json({ success: true, data: reportContent, reportContent });
      } catch (err) {
        console.error('generate-report error:', err);
        const msg = err.message || (err.error && err.error.message) || 'Report generation failed.';
        return res.status(502).json({ success: false, message: msg });
      }
    }

    // POST /api/news（爬虫写入）
    if (isNews && method === 'POST') {
      const newsItem = req.body;
      const result = await saveNews(newsItem);
      return res.status(200).json({ success: true, data: result });
    }

    // GET /api/health
    if ((path === 'health' || url.includes('/api/health')) && method === 'GET') {
      return res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
      });
    }

    // GET /api/cron（定时爬虫，需 Bearer CRON_SECRET）
    if ((path === 'cron' || url.includes('/api/cron')) && method === 'GET') {
      const expectedSecret = process.env.CRON_SECRET;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!expectedSecret) return res.status(500).json({ success: false, message: 'CRON_SECRET not configured.' });
      if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      const { crawlAllNews } = require('../crawler/news-crawler');
      await crawlAllNews();
      return res.status(200).json({ success: true, message: 'Crawler finished' });
    }

    // GET /api/favorites
    if ((path === 'favorites' || url.includes('/api/favorites')) && method === 'GET') {
      const { userId } = req.query || {};
      if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
      const data = await getUserFavorites(userId);
      return res.status(200).json({ success: true, data });
    }

    // POST /api/favorites
    if ((path === 'favorites' || url.includes('/api/favorites')) && method === 'POST') {
      const { userId, newsId } = req.body || {};
      if (!userId || !newsId) return res.status(400).json({ success: false, message: 'userId and newsId are required' });
      const result = await addFavorite(userId, newsId);
      return res.status(200).json(result);
    }

    // DELETE /api/favorites
    if ((path === 'favorites' || url.includes('/api/favorites')) && method === 'DELETE') {
      const { userId, newsId } = req.body || {};
      if (!userId || !newsId) return res.status(400).json({ success: false, message: 'userId and newsId are required' });
      const result = await removeFavorite(userId, newsId);
      return res.status(200).json(result);
    }

    return res.status(404).json({ success: false, message: 'API Route Not Found' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: error.message });
  }
};
