#!/usr/bin/env node
/**
 * D1からQdrantへのデータ移行スクリプト
 * 
 * 使い方:
 * 1. D1からデータをエクスポート:
 *    wrangler d1 execute rss-feed-db --remote --command "SELECT * FROM articles" --json > articles.json
 * 
 * 2. このスクリプトを実行:
 *    node scripts/migrate-d1-to-qdrant.js articles.json
 */

const fs = require('fs');

// 設定
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://desktop-1.tail01a12.ts.net:8445/webhook/register-article';
const DELAY_MS = 5000; // リクエスト間の待機時間（5秒）

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateArticle(article) {
  const payload = {
    url: article.url,
    memo: article.description || '',
    publish_rss: !article.exclude_from_rss,
    // 元の登録日を保持したい場合はn8nワークフロー側で対応が必要
    original_read_at: article.read_at,
  };

  console.log(`登録中: ${article.title || article.url}`);

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`  ✓ 成功: ${result.message || 'OK'}`);
    return true;
  } catch (error) {
    console.error(`  ✗ 失敗: ${error.message}`);
    return false;
  }
}

async function main() {
  const inputFile = process.argv[2];
  
  if (!inputFile) {
    console.error('使い方: node migrate-d1-to-qdrant.js <articles.json>');
    console.error('');
    console.error('まずD1からデータをエクスポートしてください:');
    console.error('  wrangler d1 execute rss-feed-db --remote --command "SELECT * FROM articles" --json > articles.json');
    process.exit(1);
  }

  // JSONファイルを読み込み
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  
  // wranglerの出力形式に対応
  const articles = data.results || data;
  
  if (!Array.isArray(articles)) {
    console.error('エラー: articles配列が見つかりません');
    process.exit(1);
  }

  console.log(`${articles.length}件の記事を移行します...`);
  console.log(`Webhook URL: ${N8N_WEBHOOK_URL}`);
  console.log('');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`[${i + 1}/${articles.length}]`);
    
    const ok = await migrateArticle(article);
    if (ok) {
      success++;
    } else {
      failed++;
    }

    // 最後以外は待機
    if (i < articles.length - 1) {
      console.log(`  ${DELAY_MS / 1000}秒待機...`);
      await sleep(DELAY_MS);
    }
  }

  console.log('');
  console.log('=== 移行完了 ===');
  console.log(`成功: ${success}件`);
  console.log(`失敗: ${failed}件`);
}

main().catch(console.error);
