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
