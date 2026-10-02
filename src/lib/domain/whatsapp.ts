/**
 * Nombor WhatsApp: simpan dalam bentuk antarabangsa tanpa simbol (contoh 60123456789),
 * dan bina pautan wa.me yang terus membuka chat di telefon atau WhatsApp Web.
 */

/** "012-345 6789", "+6012 3456789", "60123456789" -> "60123456789". null jika tidak sah. */
export function normalizeMyPhone(raw: string): string | null {
  let d = raw.trim().replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `60${d.slice(1)}`;
  else if (/^1\d{8,9}$/.test(d)) d = `60${d}`; // 123456789 (tanpa 0 di depan)
  d = d.replace(/\D/g, "");
  return /^\d{10,15}$/.test(d) ? d : null;
}

/** Cari nombor telefon pertama dalam teks bebas (contoh medan "Contact" lama). */
export function phoneFromText(text: string): string | null {
  const m = text.match(/\+?\d[\d\s-]{7,16}\d/);
  return m ? normalizeMyPhone(m[0]) : null;
}

/** Nombor WhatsApp KOL: medan khas, atau nombor dalam medan Contact. */
export function kolWhatsapp(k: { whatsapp?: string; contact?: string }): string | null {
  return (k.whatsapp && normalizeMyPhone(k.whatsapp)) || (k.contact ? phoneFromText(k.contact) : null);
}

export function waLink(phone: string, message?: string): string {
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** 60123456789 -> +60 12-345 6789 (paparan sahaja). */
export function formatPhone(d: string): string {
  if (d.startsWith("60") && d.length >= 11) {
    const r = d.slice(2);
    const head = r.startsWith("11") ? r.slice(0, 2) + "-" + r.slice(2, 6) : r.slice(0, 2) + "-" + r.slice(2, 5);
    const tail = r.startsWith("11") ? r.slice(6) : r.slice(5);
    return `+60 ${head} ${tail}`;
  }
  return `+${d}`;
}
