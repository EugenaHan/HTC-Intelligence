const axios = require('axios');
const cheerio = require('cheerio');

// News sources configuration
const NEWS_SOURCES = [
  {
    name: 'Travel And Tour World',
    baseUrl: 'https://www.travelandtourworld.com',
    searchUrl: 'https://www.travelandtourworld.com/news/',
    selectors: {
      articles: 'article.post',
      title: 'h2.entry-title a',
      link: 'h2.entry-title a',
      summary: '.entry-content p',
      date: '.entry-date'
    }
  },
  {
    name: 'Dragon Trail',
    baseUrl: 'https://www.dragontrail.com',
    searchUrl: 'https://www.dragontrail.com/resources/blog',
    selectors: {
      articles: '.blog-post',
      title: 'h2 a',
      link: 'h2 a',
      summary: '.excerpt',
      date: '.date'
    }
  }
];

// Keywords for searching
const KEYWORDS = [
  'China outbound travel',
  'Chinese tourists',
  'China tourism',
  'Chinese travelers',
  'China market',
  'Chinese visitors',
  'China travel trend',
  'Chinese tourist spending'
];

// Categories mapping
function categorizeNews(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  const categories = [];
  
  // Short Haul destinations
  if (text.includes('thailand') || text.includes('malaysia') || text.includes('singapore') || 
      text.includes('vietnam') || text.includes('indonesia') || text.includes('bali') ||
      text.includes('japan') || text.includes('korea') || text.includes('seoul')) {
    categories.push('Short Haul');
  }
  
  // Long Haul destinations
  if (text.includes('australia') || text.includes('new zealand') || text.includes('europe') ||
      text.includes('france') || text.includes('germany') || text.includes('uk') ||
      text.includes('dubai') || text.includes('turkey') || text.includes('usa') ||
      text.includes('canada') || text.includes('hawaii')) {
    categories.push('Long Haul');
  }
  
  // Visa policy
  if (text.includes('visa') || text.includes('visa-free') || text.includes('visa policy')) {
    categories.push('Visa Policy');
  }
  
  // Flight routes
  if (text.includes('flight') || text.includes('airline') || text.includes('route') || 
      text.includes('direct flight') || text.includes('nonstop')) {
    categories.push('Flight Routes');
  }
  
  // Market data
  if (text.includes('growth') || text.includes('increase') || text.includes('visitor') ||
      text.includes('arrival') || text.includes('tourist number') || text.includes('booking')) {
    categories.push('Market Data');
  }
  
  // Market trend
  if (text.includes('trend') || text.includes('outlook') || text.includes('forecast') ||
      text.includes('survey') || text.includes('report')) {
    categories.push('Market Trend');
  }
  
  return categories.length > 0 ? categories : ['Market Trend'];
}

// Sentiment analysis
function analyzeSentiment(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  
  const positiveKeywords = ['growth', 'increase', 'surge', 'rise', 'boom', 'recover', 'expand', 'boost'];
  const negativeKeywords = ['decline', 'drop', 'fall', 'decrease', 'plunge', 'slump', 'crash'];
  
  let positiveCount = positiveKeywords.filter(kw => text.includes(kw)).length;
  let negativeCount = negativeKeywords.filter(kw => text.includes(kw)).length;
  
  if (positiveCount > negativeCount) return '利好';
  if (negativeCount > positiveCount) return '威胁';
  return '中立';
}

// Generate insight
function generateInsight(categories, sentiment) {
  if (categories.includes('Short Haul')) {
    return "Southeast Asia's visa-free policies and short flight times pose strong competition. Hawaii must emphasize unique long-haul experiences.";
  }
  if (categories.includes('Long Haul')) {
    return "Long-haul destinations expanding flight connectivity. HTA must work with airlines to restore China-Hawaii direct routes.";
  }
  if (categories.includes('Visa Policy')) {
    return "Competitors expanding visa-free access. HTA should intensify advocacy for streamlined US visa processing.";
  }
  if (categories.includes('Flight Routes')) {
    return "Competitors adding direct flights from China. HTA must prioritize airline partnerships for route restoration.";
  }
  return "Monitor market developments and adjust marketing strategies accordingly.";
}

// Crawl news from a source
async function crawlSource(source) {
  try {
    console.log(`Crawling ${source.name}...`);
    
    const response = await axios.get(source.searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];
    
    $(source.selectors.articles).each((i, elem) => {
      const titleElem = $(elem).find(source.selectors.title);
      const title = titleElem.text().trim();
      const link = titleElem.attr('href');
      const summary = $(elem).find(source.selectors.summary).text().trim();
      const dateText = $(elem).find(source.selectors.date).text().trim();
      
      if (title && link) {
        // Check if article contains relevant keywords
        const text = (title + ' ' + summary).toLowerCase();
        const isRelevant = KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
        
        if (isRelevant) {
          const categories = categorizeNews(title, summary);
          const sentiment = analyzeSentiment(title, summary);
          const insight = generateInsight(categories, sentiment);
          
          // Parse date
          let date = new Date().toISOString().split('T')[0];
          if (dateText) {
            const parsedDate = new Date(dateText);
            if (!isNaN(parsedDate)) {
              date = parsedDate.toISOString().split('T')[0];
            }
          }
          
          articles.push({
            title,
            url: link.startsWith('http') ? link : source.baseUrl + link,
            summary: summary.substring(0, 300) + (summary.length > 300 ? '...' : ''),
            source: source.name,
            date,
            categories,
            sentiment,
            insight,
            month: date.substring(0, 7).replace('-', '年') + '月'
          });
        }
      }
    });
    
    console.log(`Found ${articles.length} articles from ${source.name}`);
    return articles;
    
  } catch (error) {
    console.error(`Error crawling ${source.name}:`, error.message);
    return [];
  }
}

// Main crawler function
async function crawlAllNews() {
  console.log('Starting news crawler...');
  console.log('Timestamp:', new Date().toISOString());
  
  const allNews = [];
  
  for (const source of NEWS_SOURCES) {
    const news = await crawlSource(source);
    allNews.push(...news);
    
    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Remove duplicates based on title
  const uniqueNews = [];
  const seenTitles = new Set();
  
  for (const news of allNews) {
    if (!seenTitles.has(news.title)) {
      seenTitles.add(news.title);
      uniqueNews.push(news);
    }
  }
  
  console.log(`\nTotal unique articles: ${uniqueNews.length}`);
  
  // Save to database via API
  if (uniqueNews.length > 0) {
    const API_URL = process.env.API_URL || 'http://localhost:3000/api';
    
    for (const news of uniqueNews) {
      try {
        await axios.post(`${API_URL}/news`, news, {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Saved: ${news.title.substring(0, 50)}...`);
      } catch (error) {
        console.error(`Error saving news:`, error.message);
      }
    }
  }
  
  console.log('Crawler finished!');
  return uniqueNews;
}

// Run if called directly
if (require.main === module) {
  crawlAllNews().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Crawler failed:', error);
    process.exit(1);
  });
}

module.exports = { crawlAllNews };
