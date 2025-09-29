-- RSS Feed除外フラグを追加するマイグレーション
-- 実行日: 2025-09-29
-- 概要: articlesテーブルにexclude_from_rssカラムとインデックスを追加

-- 除外フラグカラムを追加（デフォルト値: FALSE）
ALTER TABLE articles ADD COLUMN exclude_from_rss BOOLEAN DEFAULT FALSE;

-- RSS Feed生成用の複合インデックスを追加
-- exclude_from_rssとread_atの組み合わせでクエリを最適化
CREATE INDEX IF NOT EXISTS idx_articles_rss_feed ON articles(exclude_from_rss, read_at DESC);