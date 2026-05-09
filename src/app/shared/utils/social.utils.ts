export function openExternal(url: string): void {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
}

export function buildWhatsappUrl(tel: string, text?: string): string {
    const base = `https://wa.me/${tel}`;
    return text ? `${base}/?text=${encodeURIComponent(text)}` : base;
}
