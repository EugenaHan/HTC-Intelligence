#!/usr/bin/env node
/**
 * 检查主域名级别的RSS feed
 */
const axios = require('axios');
const cheerio = require('cheerio');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sites = [
  { name: 'China Daily', mainDomain: 'https://www.chinadaily.com.cn' },
  { name: 'Global Times', mainDomain: 'https://www.globaltimes.cn' },
  { name: 'Jing Daily', mainDomain: 'https://jingdaily.com' },
  { name: 'China Travel News', mainDomain: 'https://www.chinatravelnews.com' }
];

async function checkMainDomainRSS(site) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 检查: ${site.name}`);
  console.log(`URL: ${site.mainDomain}`);
  console.log('-'.repeat(60));

  try {
    const res = await axios.get(site.mainDomain, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const foundRSS = [];

    // 查找所有RSS/Atom链接
    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).attr('title') || $(el).text().trim();
      if (href) {
        foundRSS.push({ href, title });
      }
    });

    // 查找页面中包含"rss"或"feed"的链接
    $('a[href*="rss"], a[href*="feed"], a[href*="xml"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && text.toLowerCase().includes('rss') || text.toLowerCase().includes('feed')) {
        foundRSS.push({ href, title: text });
      }
    });

    if (foundRSS.length > 0) {
      console.log(`\n✅ 找到 ${foundRSS.length} 个RSS/Atom链接:`);
      foundRSS.forEach((rss, i) => {
        console.log(`   ${i + 1}. ${rss.href}`);
        if (rss.title) console.log(`      标题: ${rss.title}`);
      });
    } else {
      console.log(`\n❌ 未找到RSS feed`);
    }

    // 测试一些常见的主域名RSS路径
    const commonPaths = [
      '/rss.xml',
      '/feed',
      '/feed.xml',
      '/rss'
    ];

    console.log(`\n🔧 测试常见路径...`);
    for (const path of commonPaths) {
      const testURL = site.mainDomain.replace(/\/$/, '') + path;
      try {
        const testRes = await axios.head(testURL, {
          timeout: 8000,
          validateStatus: () => true
        });

        if (testRes.status === 200) {
          console.log(`   ✅ [200] ${testURL}`);
        }
      } catch(e) {
        // 忽略错误
      }
    }

  } catch (e) {
    console.error(`❌ 错误: ${e.message}`);
  }
}

async function main() {
  console.log('🔍 检查主域名级别的RSS feed\n');

  for (const site of sites) {
    await checkMainDomainRSS(site);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 替代方案');
  console.log('='.repeat(60));
  console.log('\n如果这些网站没有RSS，可以考虑：');
  console.log('\n1. 使用Bing News搜索（但之前测试失败）');
  console.log('2. 使用其他有RSS的中国旅游相关网站：');
  console.log('   - Travel Daily China');
  console.log('   - TNO (China Tourism News)');
  console.log('   - BTN (Business Travel News China)');
  console.log('\n3. 直接HTML抓取（需要编写专门的解析器）');
  console.log('   但这会增加复杂度和维护成本');
  console.log('\n4. 推荐方案：使用已有的稳定垂直源');
  console.log('   (当前5个源已经非常优秀)\n');
  console.log('='.repeat(60) + '\n');
}

main();
