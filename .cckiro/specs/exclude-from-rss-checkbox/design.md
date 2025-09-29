# RSS Feed除外機能 - 設計書

## システム設計概要

RSS Feed除外機能を実装するため、データベーススキーマ、API、UI、RSSフィード生成の各層で変更を行う。

## データベース設計

### 1. テーブル変更

#### articlesテーブル
現在のスキーマに `exclude_from_rss` カラムを追加：

```sql
-- 既存テーブル構造
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  description TEXT,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  exclude_from_rss BOOLEAN DEFAULT FALSE  -- 新規追加
);
```

#### マイグレーション
```sql
-- マイグレーション用SQL
ALTER TABLE articles ADD COLUMN exclude_from_rss BOOLEAN DEFAULT FALSE;
```

### 2. インデックス設計

RSS Feed生成のパフォーマンス向上のため、新しいインデックスを追加：

```sql
-- RSS Feed生成用の複合インデックス
CREATE INDEX idx_articles_rss_feed ON articles(exclude_from_rss, read_at DESC);
```

## API設計

### 1. POST /api/articles の変更

#### リクエストボディ
```typescript
interface CreateArticleRequest {
  url: string;                    // 必須
  description?: string;           // 省略可
  exclude_from_rss?: boolean;     // 省略可、デフォルト: false
}
```

#### レスポンス
```typescript
interface CreateArticleResponse {
  success: boolean;
  message: string;
  data: {
    title: string;
    url: string;
    description: string;
    exclude_from_rss: boolean;    // 新規追加
  };
}
```

### 2. GET /api/articles の変更

#### レスポンス
```typescript
interface GetArticlesResponse {
  articles: Array<{
    id: number;
    title: string;
    url: string;
    description: string;
    read_at: string;
    exclude_from_rss: boolean;    // 新規追加
  }>;
}
```

### 3. GET /feed.xml の変更

#### クエリ変更
```sql
-- 現在
SELECT * FROM articles ORDER BY read_at DESC LIMIT 50

-- 変更後
SELECT * FROM articles
WHERE exclude_from_rss = FALSE
ORDER BY read_at DESC
LIMIT 50
```

## UI設計

### 1. 記事追加フォーム（index.html）

#### HTML構造
```html
<div class="form-group">
  <label for="description">メモ</label>
  <textarea
    id="description"
    name="description"
    placeholder="この記事についてのメモ（省略可）"
  ></textarea>
  <p class="help-text">後で見返すときのためのメモを残せます</p>
</div>

<!-- 新規追加 -->
<div class="form-group">
  <div class="checkbox-group">
    <input type="checkbox" id="excludeFromRss" name="excludeFromRss">
    <label for="excludeFromRss" class="checkbox-label">
      RSS feedから除外
    </label>
  </div>
  <p class="help-text">チェックを入れると、この記事はRSS feedに含まれません</p>
</div>
```

#### CSS追加
```css
.checkbox-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-label {
  font-size: 14px;
  color: #444;
  cursor: pointer;
  margin-bottom: 0;
}

input[type="checkbox"] {
  width: auto;
  margin: 0;
  cursor: pointer;
}
```

#### JavaScript変更
```javascript
// フォーム送信処理の変更
const data = {
  url: urlInput,
  description: formData.get('description') || '',
  exclude_from_rss: document.getElementById('excludeFromRss').checked  // 新規追加
};
```

### 2. 記事一覧（articles.html）

#### 表示変更
各記事に除外状態を表示：

```html
<div class="article-title">
  ${escapeHtml(article.title)}
  ${article.exclude_from_rss ? '<span class="exclude-badge">RSS除外</span>' : ''}
</div>
```

#### CSS追加
```css
.exclude-badge {
  background: #ff9500;
  color: white;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  vertical-align: middle;
}
```

## コンポーネント設計

### 1. TypeScript型定義

#### 記事型の更新
```typescript
// src/index.ts
interface Article {
  id: number;
  title: string;
  url: string;
  description: string;
  read_at: string;
  exclude_from_rss: boolean;  // 新規追加
}

// Bindings型は変更なし
type Bindings = {
  DB: D1Database;
  API_KEY: string;
  BASIC_USERNAME: string;
  BASIC_PASSWORD: string;
};
```

### 2. RSS生成関数の更新

#### src/utils/rss.ts
```typescript
export function generateRSS(articles: Array<{
  id: number;
  title: string;
  url: string;
  description: string;
  read_at: string;
  exclude_from_rss: boolean;  // 新規追加（フィルタリング前提なので実質不要だが型安全性のため）
}>): string {
  // 実装は変更なし（呼び出し側でフィルタリング済みのため）
}
```

## セキュリティ設計

### 1. 入力検証
- `exclude_from_rss` パラメータのboolean型チェック
- 不正な値の場合はデフォルト値（false）を使用

### 2. 権限制御
- 既存の認証機能（basicAuth）をそのまま使用
- 新規パラメータによる権限昇格の防止

## パフォーマンス設計

### 1. データベースクエリ最適化
- RSS Feed生成時のWHERE句追加による絞り込み
- 新規インデックス `idx_articles_rss_feed` でクエリ最適化

### 2. レスポンス時間
- 既存機能のレスポンス時間に影響を与えない設計
- チェックボックス追加によるUI描画時間への影響は最小限

## エラーハンドリング設計

### 1. データベースエラー
- マイグレーション失敗時の対応
- 制約違反時の適切なエラーメッセージ

### 2. APIエラー
- 不正な `exclude_from_rss` 値の処理
- 既存のエラーハンドリング機能を拡張

### 3. UI エラー
- チェックボックス状態の保持
- フォーム送信失敗時の状態復元

## 移行戦略

### 1. データ移行
1. ALTER TABLE でカラム追加
2. 既存データは自動的に `FALSE` に設定される
3. インデックス追加

### 2. デプロイ戦略
1. データベースマイグレーション実行
2. バックエンドコード更新
3. フロントエンドファイル更新

### 3. ロールバック計画
- カラムの削除は行わない（データ保持）
- 新機能の無効化のみで対応