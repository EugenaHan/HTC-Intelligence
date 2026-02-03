const { getNews, saveNews, getUserFavorites, addFavorite, removeFavorite } = require('./db');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Get path from query or URL
  let path = req.query.path;
  
  // If no path in query, try to extract from URL
  if (!path && req.url) {
    const urlMatch = req.url.match(/\/api\/([^?]+)/);
    if (urlMatch) {
      path = urlMatch[1];
    }
  }
  
  console.log('API Request:', req.method, path, req.url);

  try {
    // GET /api/cron - 定时任务触发爬虫（需 Bearer 验证）
    if (path === 'cron' && req.method === 'GET') {
      const expectedSecret = process.env.CRON_SECRET;
      const authHeader = req.headers.authorization || req.headers.Authorization;

      if (!expectedSecret) {
        return res.status(500).json({
          success: false,
          message: 'Server missing CRON_SECRET configuration'
        });
      }
      if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const { crawlAllNews } = require('../crawler/news-crawler');
      await crawlAllNews();
      return res.status(200).json({
        success: true,
        message: 'Crawler finished'
      });
    }

    // GET /api/news - Get news with filters
    if (path === 'news' && req.method === 'GET') {
      const { segment, category, userId } = req.query;
      
      let filters = {};
      if (segment && segment !== 'all') {
        filters.categories = { $in: [segment] };
      }
      if (category && category !== 'all') {
        filters.categories = { $in: [category] };
      }
      
      const news = await getNews(filters);
      
      // If userId provided, get favorites
      let favorites = [];
      if (userId) {
        favorites = await getUserFavorites(userId);
      }
      
      return res.status(200).json({
        success: true,
        data: news.map(item => ({
          ...item,
          isFavorite: favorites.includes(item._id.toString())
        })),
        count: news.length
      });
    }

    // POST /api/news - Add new news (for crawler)
    if (path === 'news' && req.method === 'POST') {
      const newsItem = req.body;
      const result = await saveNews(newsItem);
      return res.status(200).json({
        success: true,
        data: result
      });
    }

    // GET /api/favorites - Get user favorites
    if (path === 'favorites' && req.method === 'GET') {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId is required'
        });
      }
      
      const favorites = await getUserFavorites(userId);
      return res.status(200).json({
        success: true,
        data: favorites
      });
    }

    // POST /api/favorites - Add to favorites
    if (path === 'favorites' && req.method === 'POST') {
      const { userId, newsId } = req.body;
      if (!userId || !newsId) {
        return res.status(400).json({
          success: false,
          message: 'userId and newsId are required'
        });
      }
      
      const result = await addFavorite(userId, newsId);
      return res.status(200).json(result);
    }

    // DELETE /api/favorites - Remove from favorites
    if (path === 'favorites' && req.method === 'DELETE') {
      const { userId, newsId } = req.body;
      if (!userId || !newsId) {
        return res.status(400).json({
          success: false,
          message: 'userId and newsId are required'
        });
      }
      
      const result = await removeFavorite(userId, newsId);
      return res.status(200).json(result);
    }

    // GET /api/health - Health check
    if (path === 'health' && req.method === 'GET') {
      return res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
      });
    }

    // POST /api/generate-report - LLM report from selected news (input: { news: [...] })
    if (path === 'generate-report' && req.method === 'POST') {
      const { news } = req.body || {};
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          message: 'Report generation is not configured. Set OPENAI_API_KEY in Vercel environment variables.'
        });
      }
      if (!Array.isArray(news) || news.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Request body must include a non-empty "news" array.'
        });
      }

      const systemPrompt = `You are a Senior Market Intelligence Consultant for the Hawaii Tourism Board (HTB) China Office. Your goal is to transform raw news data into a professional, English-language executive report.

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

      const userMessage = `Generate the executive report based on the following selected news articles. Each item may include title, summary, date, source, categories, and insight. Output only the report in Markdown.\n\n${JSON.stringify(news, null, 2)}`;

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.4,
            max_tokens: 4096
          })
        });

        const data = await response.json();
        if (data.error) {
          console.error('OpenAI API error:', data.error);
          return res.status(502).json({
            success: false,
            message: data.error.message || 'LLM request failed.'
          });
        }
        const reportText = data.choices?.[0]?.message?.content?.trim() || '';
        return res.status(200).json({
          success: true,
          data: reportText
        });
      } catch (err) {
        console.error('generate-report error:', err);
        return res.status(502).json({
          success: false,
          message: err.message || 'Failed to generate report.'
        });
      }
    }

    // 404 - Not Found
    return res.status(404).json({
      success: false,
      message: 'Endpoint not found'
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      stack: error.stack
    });
  }
};
