/**
 * AI Email Designer (#20). A small, safe block document model rendered to
 * responsive HTML + a plain-text fallback. Pure and unit-tested. All text is
 * HTML-escaped; only a fixed set of block types is supported.
 */
export type EmailBlock =
  | { type: 'text'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'button'; label: string; href: string }
  | { type: 'product'; name: string; priceCents: number; imageUrl?: string; href: string }
  | { type: 'coupon'; code: string; description?: string }
  | { type: 'divider' }
  | { type: 'footer'; storeName: string; unsubscribeUrl: string };

export interface EmailDocument {
  brandColor?: string;
  blocks: EmailBlock[];
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: string): string {
  // Only allow http(s) and mailto to avoid javascript: injection.
  return /^(https?:|mailto:)/i.test(url) ? escapeHtml(url) : '#';
}

export function renderHtml(doc: EmailDocument): string {
  const color = /^#[0-9a-fA-F]{3,8}$/.test(doc.brandColor ?? '') ? doc.brandColor! : '#4f46e5';
  const parts = doc.blocks.map((b) => renderBlock(b, color)).join('\n');
  return `<!doctype html><html><body style="margin:0;background:#f4f5fb;font-family:Arial,sans-serif;color:#1a1f36">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="padding:28px">${parts}</td></tr></table></td></tr></table></body></html>`;
}

function renderBlock(b: EmailBlock, color: string): string {
  switch (b.type) {
    case 'heading':
      return `<h1 style="font-size:22px;margin:0 0 14px">${escapeHtml(b.text)}</h1>`;
    case 'text':
      return `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${escapeHtml(b.text)}</p>`;
    case 'image':
      return `<img src="${safeUrl(b.url)}" alt="${escapeHtml(b.alt ?? '')}" style="max-width:100%;border-radius:6px;margin:0 0 14px" />`;
    case 'button':
      return `<a href="${safeUrl(b.href)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;margin:6px 0 18px">${escapeHtml(b.label)}</a>`;
    case 'product':
      return `<table role="presentation" width="100%" style="margin:0 0 14px"><tr>
${b.imageUrl ? `<td width="120"><img src="${safeUrl(b.imageUrl)}" alt="${escapeHtml(b.name)}" style="width:110px;border-radius:6px" /></td>` : ''}
<td style="padding-left:12px;vertical-align:top">
<div style="font-weight:bold">${escapeHtml(b.name)}</div>
<div style="color:#6b7280">${(b.priceCents / 100).toFixed(2)}</div>
<a href="${safeUrl(b.href)}" style="color:${color}">View product</a></td></tr></table>`;
    case 'coupon':
      return `<div style="border:2px dashed ${color};border-radius:8px;padding:14px;text-align:center;margin:0 0 16px">
<div style="font-size:20px;font-weight:bold;letter-spacing:1px">${escapeHtml(b.code)}</div>
${b.description ? `<div style="color:#6b7280;font-size:13px">${escapeHtml(b.description)}</div>` : ''}</div>`;
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e7e9f2;margin:18px 0" />`;
    case 'footer':
      return `<p style="font-size:12px;color:#9aa0bf;margin:18px 0 0">${escapeHtml(b.storeName)} · <a href="${safeUrl(b.unsubscribeUrl)}" style="color:#9aa0bf">Unsubscribe</a></p>`;
  }
}

export function renderText(doc: EmailDocument): string {
  return doc.blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
        case 'text':
          return b.text;
        case 'button':
          return `${b.label}: ${b.href}`;
        case 'product':
          return `${b.name} - ${(b.priceCents / 100).toFixed(2)} - ${b.href}`;
        case 'coupon':
          return `Coupon: ${b.code}${b.description ? ` (${b.description})` : ''}`;
        case 'footer':
          return `${b.storeName} - Unsubscribe: ${b.unsubscribeUrl}`;
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}
