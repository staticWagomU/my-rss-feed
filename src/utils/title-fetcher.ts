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
        'Accept-Charset': 'utf-8',
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
    
    const html = await response.text();
    
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