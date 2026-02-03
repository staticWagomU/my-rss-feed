export function generateRSS(
  articles: Array<{
    id: string;
    title: string;
    url: string;
    description: string;
    read_at: string;
  }>,
  feedTitle: string = 'My Reading List',
  feedLink: string = 'https://example.com'
): string {
  const items = articles.map(article => `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${escapeXml(article.url)}</link>
      <description><![CDATA[${article.description || ''}]]></description>
      <pubDate>${formatDateToRFC822(new Date(article.read_at))}</pubDate>
      <guid isPermaLink="false">${article.id}</guid>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
    <description>記事フィード</description>
    <language>ja</language>
    <lastBuildDate>${formatDateToRFC822(new Date())}</lastBuildDate>
    <atom:link href="${escapeXml(feedLink)}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
}

// Intl.DateTimeFormatを使ってAsia/TokyoタイムゾーンでRFC822形式に変換
function formatDateToRFC822(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  
  const getValue = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  const weekday = getValue('weekday');
  const day = getValue('day');
  const month = getValue('month');
  const year = getValue('year');
  const hour = getValue('hour');
  const minute = getValue('minute');
  const second = getValue('second');
  
  return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second} +0900`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
