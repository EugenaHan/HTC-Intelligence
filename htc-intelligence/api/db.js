const { MongoClient } = require('mongodb');

// 从环境变量读取，Vercel 会在部署时注入 MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI;

let cachedDb = null;
let mongoClient = null;

async function connectToDatabase() {
  // If no MongoDB URI, return null (will use fallback data)
  if (!MONGODB_URI) {
    console.log('No MONGODB_URI configured (check Vercel Env Vars), using fallback data');
    return null;
  }

  if (cachedDb) {
    return cachedDb;
  }

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // 5 second timeout
      });
      await mongoClient.connect();
    }

    // 数据库名：htc_intelligence（与 MONGODB_URI 中库名一致）
    const dbName = process.env.MONGODB_DB_NAME || 'htc_intelligence';
    const db = mongoClient.db(dbName);
    cachedDb = db;
    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    return null;
  }
}

// Fallback news data when MongoDB is not available
const fallbackNews = [
  {
    _id: '1',
    title: '中国出境游敲响变奏曲：2026年元旦出境游增长39.1%',
    date: '2026-01-29',
    source: '商务部服务贸易司',
    url: 'https://tradeinservices.mofcom.gov.cn/article/lingyu/lyqita/202601/181498.html',
    summary: '2026年元旦假期，中国出境游迎来"开门红"：内地居民出入境336.5万人次，较去年同期增长39.1%。未来十年中国旅游市场年均增速约7%，2031年有望超越美国成为全球最大旅游市场。',
    categories: ['中国出境游趋势'],
    sentiment: '利好',
    insight: '中国出境游市场复苏强劲，Z世代和银发族成为双轮驱动力，夏威夷应针对这两大群体设计差异化产品。',
    month: '2026年01月'
  },
  {
    _id: '2',
    title: '长线出境游与"Z世代"增量成元旦旅游新引擎',
    date: '2026-01-04',
    source: '飞猪/中新社',
    url: 'http://travel.china.com.cn/txt/2026-01/04/content_118260961.shtml',
    summary: '飞猪《2026元旦假期出游快报》显示，长线出境游热度显著上升，澳大利亚、俄罗斯等目的地进入热门出境游前十。"Z世代"年轻群体旅游消费表现活跃，相关旅游商品预订量同比增长超60%。',
    categories: ['中国出境游趋势', '中国消费趋势'],
    sentiment: '利好',
    insight: '中国居民消费向品质化、深度化升级，夏威夷可针对"松弛疗愈型"和"冒险探索型"游客设计高端体验产品。',
    month: '2026年01月'
  },
  {
    _id: '3',
    title: '韩国超越日本成为2026年春节中国游客最热门目的地',
    date: '2026-01-27',
    source: 'Travel And Tour World',
    url: 'https://www.travelandtourworld.com/news/article/south-korea-surpasses-japan-to-become-the-most-popular-destination-for-chinese-tourists-during-the-2026-spring-festival/',
    summary: '韩国预计将首次超越日本成为2026年春节中国游客最热门目的地。预计中国游客将达23-25万人次，比去年增长52%。这一转变由中韩政治紧张、韩元汇率有利以及韩国文化全球吸引力推动。',
    categories: ['Short Haul', 'Northeast Asia', 'Market Data'],
    sentiment: '利好',
    insight: '日本对中国游客吸引力下降为夏威夷提供机会，可通过韩国中转航线吸引中国游客。',
    month: '2026年01月'
  },
  {
    _id: '4',
    title: '东南亚将迎来中国游客爆发式增长：泰国、马来西亚、新加坡免签',
    date: '2026-01-25',
    source: 'Travel And Tour World',
    url: 'https://www.travelandtourworld.com/news/article/southeast-asia-and-thailand-to-see-explosive-growth-in-chinese-tourists-during-spring-festival-2026/',
    summary: '东南亚将在2026年春节期间迎来中国游客的爆发式增长。泰国、马来西亚和新加坡继续处于中国游客免签旅行的前沿。中国护照持有者享受泰国和马来西亚30天免签入境。',
    categories: ['Short Haul', 'Southeast Asia', 'Visa Policy'],
    sentiment: '威胁',
    insight: '东南亚签证便利化（泰国、马来西亚30天免签）和短飞行时间构成强竞争，夏威夷必须强调独特长途体验价值。',
    month: '2026年01月'
  },
  {
    _id: '5',
    title: '中国东方航空2026年开通上海-阿德莱德季节性航线',
    date: '2026-01-16',
    source: 'Travel And Tour World',
    url: 'https://www.travelandtourworld.com/news/article/air-china-unites-china-southern-airlines-china-eastern-airlines-juneyao-airlines-and-china-express-airlines-new-flight-routes-expanding-global-connectivity-in-2026/',
    summary: '中国东方航空将于2026年开通上海至澳大利亚阿德莱德的新航线。该季节性服务将每周运营三次，连接中国商业枢纽与南澳大利亚首府。此航线的开通突显了来自中国的澳大利亚旅行需求增长。',
    categories: ['Long Haul', 'Oceania', 'Flight Routes'],
    sentiment: '威胁',
    insight: '竞争对手增加中国直飞航班，HTA必须与航空公司合作恢复中国-夏威夷直飞航线。',
    month: '2026年01月'
  },
  {
    _id: '6',
    title: '迪拜春节期间吸引高消费中国游客：预计增长25-40%',
    date: '2026-02-02',
    source: 'Business Today Malaysia',
    url: 'https://www.businesstoday.com.my/2026/02/02/malaysia-dubai-set-to-gain-as-chinese-new-year-travel-shifts-away-from-us-europe/',
    summary: '预计2026年春节期间中国游客赴迪拜旅行将增长25-40%。2024年中国游客赴迪拜增长31%，预订数据显示2025年将进一步增长约27%。迪拜的吸引力在于免签入境、充足航班运力、有竞争力的价格和温暖的冬季天气。',
    categories: ['Long Haul', 'Middle East', 'Market Data'],
    sentiment: '威胁',
    insight: '迪拜和土耳其凭借免签政策崛起，HTA需加强签证便利化倡导。',
    month: '2026年02月'
  },
  {
    _id: '7',
    title: '土耳其对中国游客实施免签：2026年新90天规则',
    date: '2025-12-31',
    source: 'Travel And Tour World',
    url: 'https://www.travelandtourworld.com/news/article/turkiye-grants-visa-free-entry-to-chinese-tourists-new-ninety-day-rule-for-2026/',
    summary: '土耳其自2026年1月2日起对中国公民实施免签旅行，允许在180天内停留最多90天。2024年，访问土耳其的中国游客激增超过65%，达到近41万人次。通过取消签证要求，旅游官员预计这一数字将飙升，可能到2026年底突破百万游客大关。',
    categories: ['Long Haul', 'Middle East', 'Visa Policy'],
    sentiment: '威胁',
    insight: '竞争对手扩大免签范围，HTA应加强倡导简化美国签证流程。',
    month: '2025年12月'
  },
  {
    _id: '8',
    title: '2025年居民收入增长5.0%：人均可支配收入43377元',
    date: '2026-01-19',
    source: '国家统计局',
    url: 'https://www.stats.gov.cn/sj/zxfbhjd/202601/t20260119_1962321.html',
    summary: '2025年全国居民人均可支配收入43377元，比上年名义增长5.0%，实际增长5.0%。城镇居民人均可支配收入56502元，增长4.3%；农村居民人均可支配收入24456元，增长5.8%。人均教育文化娱乐消费支出3489元，增长9.4%，显示居民在旅游文化方面支出意愿增强。',
    categories: ['中国经济趋势'],
    sentiment: '利好',
    insight: '居民收入增长为出境游提供基础，夏威夷可适时推出中高端产品。',
    month: '2026年01月'
  }
];

// News Collection Operations
async function getNews(filters = {}) {
  const db = await connectToDatabase();
  
  // If no database connection, return fallback data
  if (!db) {
    console.log('Using fallback news data');
    let data = [...fallbackNews];
    
    // Apply filters
    if (filters.categories) {
      data = data.filter(item => item.categories.some(cat => 
        filters.categories.$in.includes(cat)
      ));
    }
    
    return data;
  }
  
  try {
    const collection = db.collection('news');
    const result = await collection.find(filters).sort({ date: -1 }).toArray();
    // 若数据库无数据，返回预设数据，避免前端“抓不到新闻”
    if (result.length === 0) {
      console.log('No news in DB, using fallback');
      let data = [...fallbackNews];
      if (filters.categories && filters.categories.$in) {
        data = data.filter(item => item.categories.some(cat => filters.categories.$in.includes(cat)));
      }
      return data;
    }
    return result;
  } catch (error) {
    console.error('Error fetching news:', error);
    return fallbackNews;
  }
}

async function saveNews(newsItem) {
  const db = await connectToDatabase();
  
  if (!db) {
    console.log('No database connection, skipping save');
    return { inserted: false, message: 'No database connection' };
  }
  
  try {
    const collection = db.collection('news');
    
    // Check if news already exists
    const existing = await collection.findOne({ title: newsItem.title });
    if (existing) {
      return { inserted: false, id: existing._id };
    }
    
    const result = await collection.insertOne({
      ...newsItem,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return { inserted: true, id: result.insertedId };
  } catch (error) {
    console.error('Error saving news:', error);
    return { inserted: false, error: error.message };
  }
}

async function deleteOldNews(days = 90) {
  const db = await connectToDatabase();
  
  if (!db) {
    return 0;
  }
  
  try {
    const collection = db.collection('news');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await collection.deleteMany({
      date: { $lt: cutoffDate.toISOString().split('T')[0] }
    });
    
    return result.deletedCount;
  } catch (error) {
    console.error('Error deleting old news:', error);
    return 0;
  }
}

// User Favorites Operations (in-memory when no DB)
const inMemoryFavorites = {};

async function getUserFavorites(userId) {
  const db = await connectToDatabase();
  
  if (!db) {
    return inMemoryFavorites[userId] || [];
  }
  
  try {
    const collection = db.collection('favorites');
    const favorites = await collection.find({ userId }).toArray();
    return favorites.map(f => f.newsId);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }
}

async function addFavorite(userId, newsId) {
  const db = await connectToDatabase();
  
  if (!db) {
    if (!inMemoryFavorites[userId]) {
      inMemoryFavorites[userId] = [];
    }
    if (!inMemoryFavorites[userId].includes(newsId)) {
      inMemoryFavorites[userId].push(newsId);
    }
    return { success: true };
  }
  
  try {
    const collection = db.collection('favorites');
    
    const existing = await collection.findOne({ userId, newsId });
    if (existing) {
      return { success: false, message: 'Already favorited' };
    }
    
    await collection.insertOne({
      userId,
      newsId,
      createdAt: new Date()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error adding favorite:', error);
    return { success: false, error: error.message };
  }
}

async function removeFavorite(userId, newsId) {
  const db = await connectToDatabase();
  
  if (!db) {
    if (inMemoryFavorites[userId]) {
      inMemoryFavorites[userId] = inMemoryFavorites[userId].filter(id => id !== newsId);
    }
    return { success: true };
  }
  
  try {
    const collection = db.collection('favorites');
    await collection.deleteOne({ userId, newsId });
    return { success: true };
  } catch (error) {
    console.error('Error removing favorite:', error);
    return { success: false, error: error.message };
  }
}

// 用户登录：htc_intelligence 库下的 users 集合，支持 email+password 或 username+password
async function getUserByEmail(email) {
  const db = await connectToDatabase();
  if (!db) return null;
  try {
    const collection = db.collection('users');
    const e = (email || '').trim().toLowerCase();
    return await collection.findOne({ $or: [{ email: e }, { username: e }] });
  } catch (error) {
    console.error('Error getUserByEmail:', error);
    return null;
  }
}

async function validateUser(email, password) {
  const user = await getUserByEmail(email);
  if (!user || !user.password) return null;
  // 简单明文比对；生产环境请用 bcrypt.compare(password, user.password)
  if (String(password) !== String(user.password)) return null;
  return {
    id: user._id.toString(),
    email: user.email,
    uid: user._id.toString()
  };
}

module.exports = {
  connectToDatabase,
  getNews,
  saveNews,
  deleteOldNews,
  getUserFavorites,
  addFavorite,
  removeFavorite,
  getUserByEmail,
  validateUser
};
