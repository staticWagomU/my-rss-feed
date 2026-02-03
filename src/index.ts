import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateRSS } from './utils/rss';
import { basicAuth } from './middleware/basic-auth';

type Bindings = {
  // 認証
  BASIC_USERNAME: string;
  BASIC_PASSWORD: string;
  // 外部サービス
  N8N_WEBHOOK_URL: string;      // n8n記事登録webhook
  QDRANT_URL: string;           // Qdrant API URL
  COHERE_API_KEY: string;       // Cohere Embedding API
  DIFY_API_URL: string;         // Dify Chat API
  DIFY_API_KEY: string;         // Dify API Key
  // 設定
  RSS_TITLE: string;
  RSS_LINK: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定
app.use('/*', cors());

// ========================================
// 記事登録 (n8n経由)
// ========================================
app.post('/api/articles', basicAuth, async (c) => {
  try {
    const body = await c.req.json();

    if (!body.url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // n8nにwebhookで送信
    const response = await fetch(c.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: body.url,
        memo: body.memo || '',
        publish_rss: body.publish_rss ?? true,
      }),
    });

    if (!response.ok) {
      throw new Error('n8n webhook failed');
    }

    const result = await response.json();
    return c.json({
      success: true,
      message: '記事登録を受け付けました',
      data: result,
    });
  } catch (error) {
    console.error('Article registration error:', error);
    return c.json({ error: 'Failed to register article' }, 500);
  }
});

// ========================================
// 記事一覧 (Qdrant直接)
// ========================================
app.get('/api/articles', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    
    // Qdrantからユニークな記事を取得（chunk_index=0のみ）
    const response = await fetch(`${c.env.QDRANT_URL}/collections/articles/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: limit,
        with_payload: true,
        with_vector: false,
        filter: {
          must: [{ key: 'chunk_index', match: { value: 0 } }]
        }
      }),
    });

    const data = await response.json();
    
    // 記事情報を整形
    const articles = (data.result?.points || []).map((point: any) => ({
      id: point.payload.article_id,
      title: point.payload.title,
      url: point.payload.url,
      summary: point.payload.summary,
      tags: point.payload.tags || [],
      memo: point.payload.memo || '',
      publish_rss: point.payload.publish_rss,
      scraped_at: point.payload.scraped_at,
    }));

    // 日付でソート（新しい順）
    articles.sort((a: any, b: any) => 
      new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
    );

    return c.json({ articles });
  } catch (error) {
    console.error('Fetch articles error:', error);
    return c.json({ error: 'Failed to fetch articles' }, 500);
  }
});

// ========================================
// 検索 (Qdrant - ベクトル検索)
// ========================================
app.post('/api/search', async (c) => {
  try {
    const body = await c.req.json();
    const query = body.query;
    const limit = body.limit || 10;

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    // Cohereでクエリをembedding
    const embedResponse = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: [query],
        model: 'embed-multilingual-v3.0',
        input_type: 'search_query',
      }),
    });

    const embedData = await embedResponse.json();
    const queryVector = embedData.embeddings[0];

    // Qdrantで検索
    const searchResponse = await fetch(`${c.env.QDRANT_URL}/collections/articles/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: queryVector,
        limit: limit,
        score_threshold: 0.3,
        with_payload: true,
      }),
    });

    const searchData = await searchResponse.json();

    // 結果を整形（重複記事を除去）
    const seenArticles = new Set<string>();
    const results = (searchData.result || [])
      .filter((item: any) => {
        const articleId = item.payload.article_id;
        if (seenArticles.has(articleId)) return false;
        seenArticles.add(articleId);
        return true;
      })
      .map((item: any) => ({
        score: item.score,
        article_id: item.payload.article_id,
        title: item.payload.title,
        url: item.payload.url,
        summary: item.payload.summary,
        chunk_text: item.payload.chunk_text,
        tags: item.payload.tags || [],
      }));

    return c.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// ========================================
// RAG検索 (Dify経由 - 自然言語で質問)
// ========================================
app.post('/api/ask', basicAuth, async (c) => {
  try {
    const body = await c.req.json();
    const question = body.question;

    if (!question) {
      return c.json({ error: 'Question is required' }, 400);
    }

    // DifyのChat APIを呼び出し
    const response = await fetch(`${c.env.DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: question,
        response_mode: 'blocking',
        user: 'web-user',
      }),
    });

    const data = await response.json();

    return c.json({
      answer: data.answer,
      conversation_id: data.conversation_id,
      sources: data.metadata?.retriever_resources || [],
    });
  } catch (error) {
    console.error('RAG search error:', error);
    return c.json({ error: 'RAG search failed' }, 500);
  }
});

// ========================================
// RSSフィード生成 (認証不要・公開)
// ========================================
app.get('/feed.xml', async (c) => {
  try {
    // Qdrantからpublish_rss=trueの記事を取得（chunk_index=0のみ）
    const response = await fetch(`${c.env.QDRANT_URL}/collections/articles/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 50,
        with_payload: true,
        with_vector: false,
        filter: {
          must: [
            { key: 'chunk_index', match: { value: 0 } },
            { key: 'publish_rss', match: { value: true } }
          ]
        }
      }),
    });

    const data = await response.json();

    // RSS用に整形
    const articles = (data.result?.points || []).map((point: any) => ({
      id: point.payload.article_id,
      title: point.payload.title,
      url: point.payload.url,
      description: point.payload.summary || point.payload.memo || '',
      read_at: point.payload.scraped_at,
    }));

    // 日付でソート
    articles.sort((a: any, b: any) => 
      new Date(b.read_at).getTime() - new Date(a.read_at).getTime()
    );

    const rssXml = generateRSS(
      articles,
      c.env.RSS_TITLE || 'My Reading List',
      c.env.RSS_LINK || 'https://example.com'
    );

    return c.text(rssXml, 200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'max-age=3600',
    });
  } catch (error) {
    console.error('RSS generation error:', error);
    return c.text('Failed to generate RSS feed', 500);
  }
});

// ========================================
// ヘルスチェック
// ========================================
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
