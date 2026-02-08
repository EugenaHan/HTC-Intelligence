#!/usr/bin/env node
/**
 * 查找中国旅游新闻源的RSS feed
 */
const axios = require('axios');
const cheerio = require('cheerio');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sites = [
  { name: 'China Daily Travel', url: 'https://www.chinadaily.com.cn/travel' },
  { name: 'Global Times Travel', url: 'https://www.globaltimes.cn/life/travel/index.html' },
  { name: 'Jing Daily Travel', url: 'https://jingdaily.com/sectors/travel' },
  { name: 'China Travel News', url: 'https://www.chinatravelnews.com/' }
];

// 常见的RSS路径
const rssPaths = [
  '/feed',
  '/rss',
  '/feed.xml',
  '/rss.xml',
  '/atom.xml',
  '?feed=rss2',
  '?feed=rss',
  '/wp-json/wp/v2/posts', // WordPress API
];

async function findRSS(site) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 搜索: ${site.name}`);
  console.log(`URL: ${site.url}`);
  console.log('-'.repeat(60));

  try {
    // 首先获取主页，查找RSS链接
    const res = await axios.get(site.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const foundRSS = [];

    // 查找页面中的RSS链接
    $('link[type="application/rss+xml"], link[type="application/atom+xml"], a[href*="rss"], a[href*="feed"]').each((i, el) => {
      const href = $(el).attr('href');
      const type = $(el).attr('type') || 'unknown';
      if (href) {
        foundRSS.push({ href, type });
      }
    });

    if (foundRSS.length > 0) {
      console.log(`\n✅ 在页面中找到 ${foundRSS.length} 个RSS链接:`);
      foundRSS.forEach((rss, i) => {
        console.log(`   ${i + 1}. ${rss.href}`);
        console.log(`      Type: ${rss.type}`);
      });
    } else {
      console.log(`\n⚠️  页面中未找到RSS链接`);
    }

    // 尝试常见的RSS路径
    console.log(`\n🔧 尝试常见RSS路径...`);
    const baseURL = site.url.replace(/\/$/, '');

    for (const path of rssPaths.slice(0, 5)) { // 只测试前5个
      const testURL = baseURL + path;
      try {
        const testRes = await axios.head(testURL, {
          timeout: 8000,
          validateStatus: () => true // 接受所有状态码
        });

        if (testRes.status === 200) {
          console.log(`   ✅ [${testRes.status}] ${testURL}`);

          // 如果找到成功的，尝试获取内容验证
          try {
            const contentRes = await axios.get(testURL, { timeout: 8000 });
            if (contentRes.data.includes('<rss') || contentRes.data.includes('<feed')) {
              console.log(`      └─ 验证：有效的RSS/Atom feed`);
            }
          } catch(e) {
            // 忽略验证错误
          }
        } else if (testRes.status === 404) {
          console.log(`   ❌ [${testRes.status}] ${testURL}`);
        }
      } catch(e) {
        // 忽略超时等错误
      }
    }

  } catch (e) {
    console.error(`❌ 错误: ${e.message}`);
  }
}

async function main() {
  console.log('🔍 查找中国旅游新闻源的RSS feed\n');

  for (const site of sites) {
    await findRSS(site);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 总结');
  console.log('='.repeat(60));
  console.log('\n建议：');
  console.log('1. 如果找到了RSS链接，使用找到的URL');
  console.log('2. 如果没有找到，考虑使用Bing搜索作为替代');
  console.log('3. 或者直接抓取HTML页面（需要修改代码）');
  console.log('='.repeat(60) + '\n');
}

main();
