# 📚 Article Search App

記事を登録・検索・RSS配信するWebアプリケーション。
AI（Cohere, Dify）を活用したベクトル検索とRAG質問機能を搭載。

## ✨ 機能

- **📝 記事登録**: URLを入力するとAIが自動で要約・タグ付け
- **📋 記事一覧**: 登録した記事をリスト表示
- **🔍 ベクトル検索**: 類似記事をセマンティック検索
- **💬 RAG質問**: 記事をもとにAIが質問に回答
- **📡 RSS配信**: 登録した記事をRSSフィードとして公開

## 🛠 技術スタック

- **フレームワーク**: [Hono](https://hono.dev/)
- **ホスティング**: [Cloudflare Pages](https://pages.cloudflare.com/)
- **ベクトルDB**: [Qdrant](https://qdrant.tech/)
- **Embedding**: [Cohere](https://cohere.ai/) (embed-multilingual-v3.0)
- **RAG**: [Dify](https://dify.ai/)
- **ワークフロー**: [n8n](https://n8n.io/)

## 📋 アーキテクチャ

```
[ブラウザ] → [Cloudflare Pages (Hono)]
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
[n8n Webhook]   [Qdrant]       [Dify RAG]
(記事登録)      (検索/一覧)    (質問応答)
    ↓
[Firecrawl] → [Gemini要約] → [Cohereタグ生成] → [Qdrant保存]
```

## 🚀 セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/article-search-app.git
cd article-search-app
```

### 2. 依存関係のインストール

```bash
npm install
# または
pnpm install
```

### 3. 環境変数の設定

```bash
cp .dev.vars.example .dev.vars
# .dev.vars を編集して各種APIキーを設定
```

必要な環境変数:
- `BASIC_USERNAME`, `BASIC_PASSWORD`: Basic認証
- `N8N_WEBHOOK_URL`: n8n記事登録webhook
- `QDRANT_URL`: Qdrant API URL
- `COHERE_API_KEY`: Cohere API Key
- `DIFY_API_URL`, `DIFY_API_KEY`: Dify API設定
- `RSS_TITLE`, `RSS_LINK`: RSSフィード設定

### 4. ローカル開発

```bash
npm run dev
# http://localhost:8787 でアクセス
```

### 5. デプロイ

```bash
npm run deploy
```

## 🔗 外部サービスの設定

### n8n ワークフロー

`article-search/n8n-workflow-article-register-v5.json` をインポート:
1. Firecrawlでスクレイピング
2. Geminiで要約生成
3. Geminiでタグ自動生成
4. Cohereでembedding生成
5. Qdrantに保存

### Dify チャットボット

`article-search/dify-chatbot-article-rag.yaml` を参考に設定:
1. 外部ナレッジベースを有効化
2. retrieval APIエンドポイントを設定

## 🔒 認証設定

### Cloudflare Access（推奨）

1. Cloudflare Zero Trust > Access > Applications
2. 新しいアプリケーションを追加
3. パス `/feed.xml` をBypass（公開）
4. その他はメール認証などを設定

## 📱 API仕様

### POST /api/articles
記事を登録（n8n経由）

```json
{
  "url": "https://example.com/article",
  "memo": "メモ",
  "publish_rss": true
}
```

### GET /api/articles
記事一覧を取得

### POST /api/search
ベクトル検索

```json
{
  "query": "検索キーワード",
  "limit": 10
}
```

### POST /api/ask
RAG質問（Dify経由）

```json
{
  "question": "A2Aプロトコルについて教えて"
}
```

### GET /feed.xml
RSSフィード（認証不要）

## 📝 ライセンス

MIT
