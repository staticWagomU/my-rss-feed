# RSS Feed除外機能 - 実装計画書

## 実装順序と詳細手順

設計書に基づいて、以下の順序で実装を進める。各ステップは依存関係を考慮して配置。

## フェーズ1: データベースマイグレーション

### 1.1 マイグレーションファイル作成
**ファイル:** `src/db/migration-add-exclude-from-rss.sql`

```sql
-- RSS Feed除外フラグを追加するマイグレーション
ALTER TABLE articles ADD COLUMN exclude_from_rss BOOLEAN DEFAULT FALSE;

-- RSS Feed生成用の複合インデックスを追加
CREATE INDEX IF NOT EXISTS idx_articles_rss_feed ON articles(exclude_from_rss, read_at DESC);
```

**実装タスク:**
- [ ] マイグレーションファイルを作成
- [ ] 既存のschema.sqlファイルを更新

### 1.2 スキーマファイル更新
**ファイル:** `src/db/schema.sql`

既存のCREATE TABLE文に新しいカラムを追加し、新しいインデックスも追加。

## フェーズ2: バックエンドAPI実装

### 2.1 型定義の更新
**ファイル:** `src/index.ts`

```typescript
// 記事型の拡張（既存コードに追加）
interface Article {
  id: number;
  title: string;
  url: string;
  description: string;
  read_at: string;
  exclude_from_rss: boolean;  // 新規追加
}
```

**実装タスク:**
- [ ] Article interface を定義（現在はインライン型なので正式に定義）
- [ ] リクエスト型の定義追加

### 2.2 POST /api/articles エンドポイント更新
**ファイル:** `src/index.ts` (32-64行目付近)

**変更内容:**
1. リクエストボディから`exclude_from_rss`を取得
2. デフォルト値の設定（省略時はfalse）
3. データベース挿入クエリの更新
4. レスポンスデータに新フィールド追加

**実装詳細:**
```typescript
// リクエストボディの処理
const excludeFromRss = body.exclude_from_rss ?? false;

// データベース挿入クエリ
await c.env.DB.prepare(
  'INSERT INTO articles (title, url, description, exclude_from_rss) VALUES (?, ?, ?, ?)'
).bind(title, body.url, description, excludeFromRss).run();

// レスポンスデータ
return c.json({
  success: true,
  message: 'Article added successfully',
  data: { title, url: body.url, description, exclude_from_rss: excludeFromRss }
});
```

**実装タスク:**
- [ ] リクエスト処理にexclude_from_rssパラメータを追加
- [ ] データベース挿入クエリを4パラメータに変更
- [ ] レスポンスデータを拡張

### 2.3 GET /api/articles エンドポイント更新
**ファイル:** `src/index.ts` (20-30行目付近)

**変更内容:**
SELECTクエリは変更不要（*で全カラム取得するため）。新カラムが自動的に含まれる。

**実装タスク:**
- [ ] レスポンス型の確認（型安全性チェック）

### 2.4 GET /feed.xml エンドポイント更新
**ファイル:** `src/index.ts` (82-97行目付近)

**変更内容:**
1. SQLクエリにWHERE句を追加
2. exclude_from_rss = FALSE の条件を追加

**実装詳細:**
```typescript
const { results } = await c.env.DB.prepare(
  'SELECT * FROM articles WHERE exclude_from_rss = FALSE ORDER BY read_at DESC LIMIT 50'
).all();
```

**実装タスク:**
- [ ] SQLクエリにWHERE句を追加
- [ ] テスト用のデータで動作確認

## フェーズ3: フロントエンド実装

### 3.1 記事追加フォーム（index.html）更新
**ファイル:** `public/index.html`

**変更箇所1: HTML構造（206行目付近）**
メモフィールドの後にチェックボックスを追加：

```html
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

**変更箇所2: CSS（172行目付近）**
チェックボックス用のスタイルを追加：

```css
.checkbox-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
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

**変更箇所3: JavaScript（240-243行目付近）**
フォームデータの取得処理を更新：

```javascript
const data = {
  url: urlInput,
  description: formData.get('description') || '',
  exclude_from_rss: document.getElementById('excludeFromRss').checked
};
```

**実装タスク:**
- [ ] HTMLにチェックボックスフィールドを追加
- [ ] CSSスタイルを追加
- [ ] JavaScriptのデータ取得処理を更新
- [ ] フォームリセット時の動作確認

### 3.2 記事一覧（articles.html）更新
**ファイル:** `public/articles.html`

**変更箇所1: CSS（230行目付近）**
除外バッジ用のスタイルを追加：

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

**変更箇所2: JavaScript（272-290行目付近）**
記事タイトルの表示部分を更新：

```javascript
<div class="article-title">
  ${escapeHtml(article.title)}
  ${article.exclude_from_rss ? '<span class="exclude-badge">RSS除外</span>' : ''}
</div>
```

**実装タスク:**
- [ ] CSSで除外バッジのスタイルを追加
- [ ] JavaScriptで条件付きバッジ表示を実装
- [ ] 表示レイアウトの確認

## フェーズ4: テスト・検証

### 4.1 単体テスト項目
- [ ] チェックボックス未チェック時（デフォルト）の動作
- [ ] チェックボックスチェック時の動作
- [ ] パラメータ省略時のデフォルト値設定
- [ ] 不正な値（文字列等）送信時の処理

### 4.2 統合テスト項目
- [ ] 除外フラグなしの記事がRSSに含まれることを確認
- [ ] 除外フラグありの記事がRSSに含まれないことを確認
- [ ] 記事一覧で両方のタイプが表示されることを確認
- [ ] フォームの送信・表示サイクルが正常に動作することを確認

### 4.3 手動テスト項目
- [ ] UI/UXの確認（チェックボックスの操作感）
- [ ] レスポンシブデザインの確認
- [ ] エラーハンドリングの確認
- [ ] パフォーマンスの確認（RSS生成時間）

## フェーズ5: ドキュメント・クリーンアップ

### 5.1 実装完了確認
- [ ] 全受け入れ基準の達成確認
- [ ] コードレビューの実施
- [ ] 不要なコメント・デバッグコードの削除

### 5.2 デプロイ準備
- [ ] マイグレーションの実行順序確認
- [ ] 本番環境でのテストデータ準備
- [ ] ロールバック手順の確認

## 実装時の注意点

### セキュリティ
- [ ] boolean型以外の値が送信された場合の適切な処理
- [ ] SQL injection対策の確認（Prepared Statementを使用）

### パフォーマンス
- [ ] 新しいインデックスが適切に使用されることの確認
- [ ] RSS生成クエリのEXPLAIN実行

### 互換性
- [ ] 既存APIの後方互換性維持
- [ ] 既存データの適切な処理

## エラーハンドリング重点項目

1. **データベースエラー**
   - [ ] マイグレーション失敗時の対処
   - [ ] インデックス作成失敗時の対処

2. **APIエラー**
   - [ ] 型変換エラーの適切な処理
   - [ ] 不正なパラメータの処理

3. **UIエラー**
   - [ ] JavaScript無効時の優雅な劣化
   - [ ] ネットワークエラー時の状態保持

## 実装完了の定義

全ての実装タスクが完了し、全ての受け入れ基準を満たし、手動テストでの問題が解決された状態を「実装完了」とする。