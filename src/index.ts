import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateRSS } from './utils/rss';
import { fetchTitle } from './utils/title-fetcher';
import { basicAuth } from './middleware/basic-auth';

type Bindings = {
  DB: D1Database;
  API_KEY: string;
  BASIC_USERNAME: string;
  BASIC_PASSWORD: string;
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

// 記事登録API（認証必須）
app.post('/api/articles', basicAuth, async (c) => {
  try {
    // API Key認証（ショートカット用）
    const apiKey = c.req.header('X-API-Key');
    const body = await c.req.json();

    // 基本的なバリデーション
    if (!body.url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // URLからタイトルを自動取得
    const title = await fetchTitle(body.url);
    const description = body.description || '';
    const excludeFromRss = body.exclude_from_rss ?? false;

    // データベースに保存
    await c.env.DB.prepare(
      'INSERT INTO articles (title, url, description, exclude_from_rss) VALUES (?, ?, ?, ?)'
    ).bind(title, body.url, description, excludeFromRss).run();

    return c.json({
      success: true,
      message: 'Article added successfully',
      data: { title, url: body.url, description, exclude_from_rss: excludeFromRss }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return c.json({ error: 'This URL has already been added' }, 409);
    }
    return c.json({ error: 'Failed to add article' }, 500);
  }
});

// 記事削除API（認証必須）
app.delete('/api/articles/:id', basicAuth, async (c) => {
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
      'SELECT * FROM articles WHERE exclude_from_rss = FALSE ORDER BY read_at DESC LIMIT 50'
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

export default app;
