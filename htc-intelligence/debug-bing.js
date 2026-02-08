#!/usr/bin/env node
/**
 * Bing RSS 调试脚本 - 检查实际响应内容
 */
const axios = require('axios');
const cheerio = require('cheerio');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function debugBingResponse() {
  console.log('🔍 调试 Bing News RSS 响应...\n');

  const url = 'https://www.bing.com/news/search?q=travel&format=rss';

  try {
    console.log(`请求 URL: ${url}\n`);

    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/xhtml+xml'
      },
      timeout: 15000
    });

    console.log(`✅ HTTP 状态码: ${res.status}`);
    console.log(`📄 Content-Type: ${res.headers['content-type']}`);
    console.log(`📦 响应大小: ${res.data.length} bytes\n`);

    // 检查是否是 XML
    const isXML = res.data.includes('<?xml') || res.data.includes('<rss');
    console.log(`📋 是否为 RSS/XML: ${isXML ? '是' : '否'}\n`);

    // 显示前 500 个字符
    console.log('📝 响应内容预览 (前 500 字符):');
    console.log('─'.repeat(60));
    console.log(res.data.substring(0, 500));
    console.log('─'.repeat(60));

    // 尝试解析
    console.log('\n🔧 尝试解析 XML...');
    const $ = cheerio.load(res.data, { xmlMode: true });

    const rss = $('rss');
    const channel = $('channel');
    const items = $('item');

    console.log(`   RSS 标签: ${rss.length > 0 ? '找到' : '未找到'}`);
    console.log(`   Channel 标签: ${channel.length > 0 ? '找到' : '未找到'}`);
    console.log(`   Item 标签: ${items.length} 个`);

    if (items.length > 0) {
      console.log('\n✅ 找到文章！');
      items.slice(0, 3).each((i, el) => {
        const title = $(el).find('title').text();
        console.log(`   ${i + 1}. ${title}`);
      });
    } else {
      console.log('\n⚠️  未找到文章，检查 channel 内容...');

      // 检查 channel 下的其他标签
      const title = channel.find('title').text();
      const description = channel.find('description').text();

      console.log(`   Channel Title: ${title || '无'}`);
      console.log(`   Channel Description: ${description || '无'}`);

      // 检查错误信息
      if (res.data.includes('error') || res.data.includes('blocked')) {
        console.log('\n❌ 响应中包含错误或阻止信息');
      }
    }

  } catch (e) {
    console.error(`\n❌ 请求失败: ${e.message}`);
    if (e.response) {
      console.error(`   状态码: ${e.response.status}`);
      console.error(`   响应数据: ${e.response.data?.substring(0, 200)}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 结论:');
  console.log('   如果所有配置都返回 0 篇文章，可能是因为:');
  console.log('   1. Bing News RSS 已停止公开服务');
  console.log('   2. 需要认证或特定 cookie');
  console.log('   3. 对自动化请求有限制');
  console.log('   4. IP 地址被限流');
  console.log('\n   建议方案:');
  console.log('   - 使用稳定的垂直 RSS 源（如 Moodie Davitt, TTR, Skift）');
  console.log('   - 替换为 Google News RSS');
  console.log('   - 直接移除 Bing 源');
  console.log('='.repeat(60));

  process.exit(0);
}

debugBingResponse();
