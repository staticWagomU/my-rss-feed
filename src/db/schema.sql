CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  description TEXT,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  exclude_from_rss BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_articles_read_at ON articles(read_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_rss_feed ON articles(exclude_from_rss, read_at DESC);
