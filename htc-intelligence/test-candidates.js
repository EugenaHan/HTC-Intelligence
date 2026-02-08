#!/usr/bin/env node
/**
 * 测试候选旅游新闻RSS源
 */
const axios = require('axios');
const cheerio = require('cheerio');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const candidates = [
  {
    name: 'Travel Pulse',
    url: 'https://www.travelpulse.com/rss'
  },
  {
    name: 'Hospitality Net',
    url: 'https://www.hospitalitynet.org/news/rss.xml'
  },
  {
    name: 'Hotel News Online',
    url: 'https://www.hotelnewsresource.com/rss/news.xml'
  },
  {
    name: 'Airport Technology',
    url: 'https://www.airport-technology.com/newsrss.xml'
  },
  {
    name: 'Business Travel News Europe',
    url: 'https://www.businesstraveller.com/business-travel/rss.xml'
  },
  {
    name: 'Travel Daily',
    url: 'https://www.traveldailynews.com/rss'
  },
  {
    name: 'Breaking Travel News',
    url: 'https://www.breakingtravelnews.com/rss'
  },
  {
    name: 'Travel Weekly UK',
    url: 'https://www.travelweekly.co.uk/rss'
  },
  {
    name: 'Lonely Planet News',
    url: 'https://www.lonelyplanet.com/travel-news/rss.xml'
  },
  {
    name: 'FVW (Business Travel)',
    url: 'https://www.fvwd.co.uk/feed/'
  }
];

async function testRSS(candidate) {
  console.log(`\n📡 ${candidate.name}`);
  console.log(`   URL: ${candidate.url}`);

  try {
    const res = await axios.get(candidate.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      timeout: 20000
    });

    const $ = cheerio.load(res.data, { xmlMode: true });
    const items = $('item');

    console.log(`   ✅ 成功！找到 ${items.length} 个项目`);

    if (items.length > 0) {
      // 显示前3个项目的标题，验证内容质量
      console.log(`   📰 最新文章:`);
      items.slice(0, 3).each((i, el) => {
        const title = $(el).find('title').text().trim();
        const pubDate = $(el).find('pubDate').text();
        console.log(`      ${i + 1}. ${title.substring(0, 60)}...`);
        if (pubDate) console.log(`         发布: ${new Date(pubDate).toLocaleDateString()}`);
      });

      return { success: true, count: items.length, source: candidate.name };
    } else {
      console.log(`   ⚠️  RSS存在但没有文章`);
      return { success: false, count: 0, source: candidate.name };
    }

  } catch (e) {
    console.error(`   ❌ 失败: ${e.message}`);
    return { success: false, count: 0, source: candidate.name };
  }
}

async function main() {
  console.log('🔍 测试候选旅游新闻RSS源');
  console.log('='.repeat(60));

  const results = [];

  for (const candidate of candidates) {
    const result = await testRSS(candidate);
    results.push(result);
  }

  // 汇总报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));

  results.forEach((r, i) => {
    if (r.success) {
      console.log(`✅ ${r.source}: ${r.count}篇/次`);
    } else {
      console.log(`❌ ${r.source}: 失败`);
    }
  });

  // 找出最佳候选
  const successful = results.filter(r => r.success);
  if (successful.length > 0) {
    console.log('\n🎉 推荐添加的源（按文章数量排序）:');
    successful.sort((a, b) => b.count - a.count);
    successful.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.source} - ${r.count}篇/次`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

main();
