export function generateRSS(articles: Array<{
  id: number;
  title: string;
  url: string;
  description: string;
  read_at: string;
}>): string {
  const items = articles.map(article => `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${escapeXml(article.url)}</link>
      <description><![CDATA[${article.description || ''}]]></description>
      <pubDate>${new Date(article.read_at).toUTCString()}</pubDate>
      <guid isPermaLink="false">${article.id}</guid>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>My Reading List</title>
    <link>https://your-domain.pages.dev</link>
    <description>Articles I've read</description>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://your-domain.pages.dev/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
