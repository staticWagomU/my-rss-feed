# 📚 RSS Feed Manager

読んだ記事を管理し、RSSフィードとして配信するシンプルなWebアプリケーション。スマートフォンからも簡単に記事を登録できます。

## ✨ 特徴

- 📱 **モバイルフレンドリー**: レスポンシブデザインでスマホから簡単操作
- 🔗 **RSS配信**: 登録した記事を標準的なRSSフィードとして配信
- ⚡ **高速動作**: Cloudflare Edgeで動作し、世界中から高速アクセス
- 📲 **iPhoneショートカット対応**: 共有シートから直接記事を保存
- 🔒 **シンプルな認証**: APIキーによる簡易認証
- 💾 **軽量データベース**: Cloudflare D1による永続化

## 🛠 技術スタック

- **フレームワーク**: [Hono](https://hono.dev/) - 軽量で高速なWebフレームワーク
- **データベース**: [Cloudflare D1](https://developers.cloudflare.com/d1/) - SQLiteベースのエッジデータベース
- **ホスティング**: [Cloudflare Pages](https://pages.cloudflare.com/) - グローバルCDN配信
- **ランタイム**: [Cloudflare Workers](https://workers.cloudflare.com/) - エッジコンピューティング

## 📋 前提条件

- Node.js 16.x以上
- npm または yarn
- Cloudflareアカウント
- Wrangler CLI

## 🚀 セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/rss-feed-app.git
cd rss-feed-app
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Cloudflare D1データベースの作成

```bash
# Wrangler CLIのインストール（未インストールの場合）
npm install -g wrangler

# Cloudflareにログイン
wrangler login

# D1データベースを作成
wrangler d1 create rss-feed-db
```

出力されたデータベースIDをメモしてください。

### 4. 設定ファイルの更新

`wrangler.toml`を編集し、データベースIDを設定：

```toml
[[d1_databases]]
binding = "DB"
database_name = "rss-feed-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← ここに先ほどのIDを設定
```

### 5. データベーススキーマの適用

```bash
wrangler d1 execute rss-feed-db --local --file=./src/db/schema.sql
```

### 6. 環境変数の設定

`.dev.vars`ファイルを作成（ローカル開発用）：

```
API_KEY=your-secret-api-key-here
```

### 7. ローカル開発サーバーの起動

```bash
wrangler dev
```

http://localhost:8787 でアプリケーションにアクセスできます。

## 🌍 デプロイ

### Cloudflare Pagesへのデプロイ

```bash
# ビルド（必要な場合）
npm run build

# デプロイ
wrangler pages deploy
```

### 本番環境の環境変数設定

1. [Cloudflareダッシュボード](https://dash.cloudflare.com/)にログイン
2. Pages > あなたのプロジェクト > Settings > Environment variables
3. `API_KEY`を追加

## 📱 使い方

### Webインターフェースから

1. ブラウザでアプリケーションにアクセス
2. URLを入力（必須）
3. タイトルとメモを入力（任意）
4. 「追加」ボタンをクリック

### iPhoneショートカットから

#### ショートカットの設定

1. iPhoneの「ショートカット」アプリを開く
2. 「+」で新規ショートカット作成
3. 以下のアクションを追加：

**アクション1: 入力を要求**
- テキストを要求
- プロンプト: "記事のURLを入力"

**アクション2: Webページから詳細を取得**
- 取得する詳細: 名前（タイトル）

**アクション3: URLの内容を取得**
- URL: `https://your-app.pages.dev/api/articles`
- メソッド: POST
- ヘッダー:
  - `Content-Type`: `application/json`
  - `X-API-Key`: `your-secret-api-key`
- 本文（JSON）:
```json
{
  "url": "[入力されたテキスト]",
  "title": "[Webページの名前]"
}
```

4. ショートカットに名前を付けて保存
5. 共有シートに追加

#### 使用方法

1. Safariなどで記事を開く
2. 共有ボタンをタップ
3. 作成したショートカットを選択
4. 自動的に記事が保存される

### RSS購読

RSSリーダーに以下のURLを登録：

```
https://your-app.pages.dev/feed.xml
```

## 🔌 API仕様

### エンドポイント

#### `GET /api/articles`
記事一覧を取得

**レスポンス:**
```json
{
  "articles": [
    {
      "id": 1,
      "title": "記事タイトル",
      "url": "https://example.com",
      "description": "メモ",
      "created_at": "2024-01-01T00:00:00Z",
      "read_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/articles`
記事を追加

**リクエスト:**
```json
{
  "url": "https://example.com",
  "title": "記事タイトル（省略可）",
  "description": "メモ（省略可）"
}
```

**レスポンス:**
```json
{
  "success": true,
  "message": "Article added successfully",
  "data": {
    "title": "記事タイトル",
    "url": "https://example.com",
    "description": "メモ"
  }
}
```

#### `DELETE /api/articles/:id`
記事を削除

**レスポンス:**
```json
{
  "success": true,
  "message": "Article deleted"
}
```

#### `GET /feed.xml`
RSSフィードを取得（RSS 2.0形式）

## 📁 プロジェクト構造

```
rss-feed-app/
├── src/
│   ├── index.ts          # メインアプリケーション
│   ├── db/
│   │   └── schema.sql    # データベーススキーマ
│   └── utils/
│       └── rss.ts        # RSS生成ユーティリティ
├── public/
│   └── index.html        # フロントエンド
├── wrangler.toml         # Cloudflare設定
├── package.json          # プロジェクト設定
├── tsconfig.json         # TypeScript設定
└── README.md            # このファイル
```

## 🔒 セキュリティ

- APIキーによる認証（ショートカット用）
- XSS対策（HTMLエスケープ）
- SQLインジェクション対策（プリペアドステートメント）
- CORS設定

## 🐛 トラブルシューティング

### データベースエラーが発生する

```bash
# スキーマを再適用
wrangler d1 execute rss-feed-db --local --file=./src/db/schema.sql
```

### デプロイに失敗する

```bash
# Wranglerを最新版に更新
npm update wrangler

# キャッシュをクリア
rm -rf .wrangler
```

### RSSフィードが更新されない

- ブラウザキャッシュをクリア
- RSSリーダーの更新間隔を確認

## 📈 今後の機能追加予定

- [ ] タグ/カテゴリー機能
- [ ] 全文検索
- [ ] アーカイブ機能
- [ ] OPMLエクスポート/インポート
- [ ] OGP情報の自動取得
- [ ] 既読/未読管理
- [ ] 複数ユーザー対応
- [ ] Webhook通知

## 🤝 コントリビュート

プルリクエストを歓迎します！大きな変更の場合は、まずissueを作成して変更内容を議論してください。

1. フォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📝 ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🙏 謝辞

- [Hono](https://hono.dev/) - 素晴らしいWebフレームワーク
- [Cloudflare](https://www.cloudflare.com/) - エッジコンピューティングプラットフォーム
- アイコン: Emoji

## 📧 連絡先

- 作者: Your Name
- Email: your.email@example.com
- Twitter: [@yourhandle](https://twitter.com/yourhandle)

---

⭐ このプロジェクトが気に入ったら、スターをお願いします！
