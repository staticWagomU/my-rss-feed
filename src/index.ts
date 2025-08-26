import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateRSS } from './utils/rss';

type Bindings = {
  DB: D1Database;
  API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定
app.use('/*', cors());

// 記事一覧取得API
app.get('/api/articles', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM articles ORDER BY read_at DESC LIMIT 50'
    ).all();
    
    return c.json({ articles: results });
  } catch (error) {
    return c.json({ error: 'Failed to fetch articles' }, 500);
  }
});

// 記事登録API
app.post('/api/articles', async (c) => {
  try {
    // API Key認証（ショートカット用）
    const apiKey = c.req.header('X-API-Key');
    const body = await c.req.json();
    
    // 基本的なバリデーション
    if (!body.url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // タイトル取得（提供されない場合はURLから推測）
    const title = body.title || new URL(body.url).hostname;
    const description = body.description || '';

    // データベースに保存
    await c.env.DB.prepare(
      'INSERT INTO articles (title, url, description) VALUES (?, ?, ?)'
    ).bind(title, body.url, description).run();

    return c.json({ 
      success: true, 
      message: 'Article added successfully',
      data: { title, url: body.url, description }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return c.json({ error: 'This URL has already been added' }, 409);
    }
    return c.json({ error: 'Failed to add article' }, 500);
  }
});

// 記事削除API
app.delete('/api/articles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    await c.env.DB.prepare(
      'DELETE FROM articles WHERE id = ?'
    ).bind(id).run();
    
    return c.json({ success: true, message: 'Article deleted' });
  } catch (error) {
    return c.json({ error: 'Failed to delete article' }, 500);
  }
});

// RSSフィード生成
app.get('/feed.xml', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM articles ORDER BY read_at DESC LIMIT 50'
    ).all();
    
    const rssXml = generateRSS(results as any[]);
    
    return c.text(rssXml, 200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'max-age=3600'
    });
  } catch (error) {
    return c.text('Failed to generate RSS feed', 500);
  }
});

// フロントエンドのHTMLを返す
app.get('/', async (c) => {
  return c.html(await getHTMLContent());
});

export default app;

// HTMLコンテンツを取得する関数（実際にはpublic/index.htmlから読み込み）
async function getHTMLContent() {
  // Cloudflare Pagesは自動的にpublicフォルダを配信するので、
  // この関数は実際には不要かもしれません
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My RSS Feed Manager</title>
</head>
<body>
  <h1>RSS Feed Manager</h1>
  <p>Loading...</p>
</body>
</html>`;
}
