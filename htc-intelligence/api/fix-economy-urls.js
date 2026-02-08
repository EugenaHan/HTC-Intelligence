/**
 * Vercel API: 修复远程数据库中的经济新闻 URL
 * 访问 /api/fix-economy-urls 即可执行
 */
const { connectToDatabase } = require('./db');

module.exports = async function handler(req, res) {
  // 安全检查：只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('news');

    const updates = [
      {
        filter: { title: { $regex: 'China.*GDP.*5\\.2', $options: 'i' }, categories: 'Macro Economy' },
        update: { $set: { url: 'https://www.stats.gov.cn/english/PressRelease/202501/t20250117_1944623.html' } }
      },
      {
        filter: { title: { $regex: 'RMB.*exchange.*rate', $options: 'i' }, categories: 'Macro Economy' },
        update: { $set: { url: 'https://www.pbc.gov.cn/en/3688230/3688250/index.html' } }
      },
      {
        filter: { title: { $regex: 'China.*CPI', $options: 'i' }, categories: 'Macro Economy' },
        update: { $set: { url: 'https://www.stats.gov.cn/english/PressRelease/202501/t20250112_1944598.html' } }
      },
      {
        filter: { title: { $regex: 'PBOC.*cuts.*reserve', $options: 'i' }, categories: 'Macro Economy' },
        update: { $set: { url: 'https://www.pbc.gov.cn/en/3688230/3688250/20250115/index.html' } }
      },
      {
        filter: { title: { $regex: 'Chinese.*consumer.*spending', $options: 'i' }, categories: 'Macro Economy' },
        update: { $set: { url: 'https://www.stats.gov.cn/english/PressRelease/202501/t20250110_1944590.html' } }
      }
    ];

    let updatedCount = 0;
    const results = [];

    for (const { filter, update } of updates) {
      const result = await collection.updateOne(filter, update);
      if (result.modifiedCount > 0) {
        updatedCount++;
        const doc = await collection.findOne(filter);
        results.push({
          title: doc.title_cn,
          oldUrl: 'example.com',
          newUrl: update.$set.url
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Updated ${updatedCount} economy news URLs`,
      results
    });

  } catch (error) {
    console.error('Error updating URLs:', error);
    res.status(500).json({ error: 'Failed to update URLs' });
  }
};
