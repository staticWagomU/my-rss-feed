import * as htmlparser2 from 'htmlparser2';

export async function fetchTitle(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS-Feed-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      console.warn(`Non-HTML content type: ${contentType}`);
      return extractDomainFromUrl(url);
    }
    
    // ArrayBufferとして取得してから、適切にデコード
    const buffer = await response.arrayBuffer();
    
    // Content-Typeからcharsetを取得
    let charset = 'utf-8';
    const charsetMatch = contentType.match(/charset=([^;]+)/i);
    if (charsetMatch) {
      charset = charsetMatch[1].trim().toLowerCase();
      // 一般的なcharsetエイリアスを正規化
      if (charset === 'shift_jis' || charset === 'shift-jis' || charset === 'sjis') {
        charset = 'shift_jis';
      } else if (charset === 'euc-jp' || charset === 'eucjp') {
        charset = 'euc-jp';
      } else if (charset === 'iso-2022-jp') {
        charset = 'iso-2022-jp';
      }
    }
    
    // 一旦UTF-8でデコードして、metaタグからcharsetを探す
    const tempDecoder = new TextDecoder('utf-8', { fatal: false });
    const tempHtml = tempDecoder.decode(buffer);
    
    // HTMLメタタグからcharsetを検出
    const metaCharsetMatch = tempHtml.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i);
    if (metaCharsetMatch) {
      const metaCharset = metaCharsetMatch[1].trim().toLowerCase();
      if (metaCharset && metaCharset !== charset) {
        charset = metaCharset;
        // 一般的なcharsetエイリアスを正規化
        if (charset === 'shift_jis' || charset === 'shift-jis' || charset === 'sjis') {
          charset = 'shift_jis';
        } else if (charset === 'euc-jp' || charset === 'eucjp') {
          charset = 'euc-jp';
        } else if (charset === 'iso-2022-jp') {
          charset = 'iso-2022-jp';
        }
      }
    }
    
    // 最終的なデコード
    let html: string;
    try {
      const decoder = new TextDecoder(charset, { fatal: false });
      html = decoder.decode(buffer);
    } catch (e) {
      // charsetがサポートされていない場合はUTF-8でフォールバック
      console.warn(`Unsupported charset: ${charset}, falling back to UTF-8`);
      const decoder = new TextDecoder('utf-8', { fatal: false });
      html = decoder.decode(buffer);
    }
    
    const dom = htmlparser2.parseDocument(html);
    const titleElement = htmlparser2.DomUtils.findOne(
      (elem) => elem.name === 'title',
      dom.children
    );
    
    if (titleElement && titleElement.children.length > 0) {
      const titleText = htmlparser2.DomUtils.textContent(titleElement);
      const cleanTitle = titleText.trim().replace(/\s+/g, ' ');
      
      if (cleanTitle) {
        return cleanTitle;
      }
    }
    
    const metaOgTitle = htmlparser2.DomUtils.findOne(
      (elem) => 
        elem.name === 'meta' && 
        elem.attribs && 
        elem.attribs.property === 'og:title' &&
        elem.attribs.content,
      dom.children
    );
    
    if (metaOgTitle && metaOgTitle.attribs.content) {
      return metaOgTitle.attribs.content.trim();
    }
    
    const metaTwitterTitle = htmlparser2.DomUtils.findOne(
      (elem) => 
        elem.name === 'meta' && 
        elem.attribs && 
        elem.attribs.name === 'twitter:title' &&
        elem.attribs.content,
      dom.children
    );
    
    if (metaTwitterTitle && metaTwitterTitle.attribs.content) {
      return metaTwitterTitle.attribs.content.trim();
    }
    
    return extractDomainFromUrl(url);
    
  } catch (error) {
    console.error('Error fetching title:', error);
    return extractDomainFromUrl(url);
  }
}

function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}