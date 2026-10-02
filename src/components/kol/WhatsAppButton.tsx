import { waLink } from "@/lib/domain/whatsapp";

/** Logo WhatsApp (putih), dilukis dalam bulatan hijau oleh butang. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path fill="currentColor" fillRule="evenodd" d="M6.94 6.88 L6.41 7.6 L6.09 8.45 L6.01 9.04 L6.01 9.44 L6.19 10.39 L6.67 11.48 L7.52 12.76 L8.48 13.93 L9.57 15.02 L10.63 15.87 L11.51 16.43 L12.84 17.04 L14.38 17.54 L14.72 17.59 L15.63 17.59 L16.08 17.51 L16.9 17.14 L17.38 16.8 L17.62 16.56 L17.86 16.19 L17.99 15.76 L18.07 15.31 L18.07 14.8 L18.02 14.7 L17.83 14.56 L15.81 13.58 L15.28 13.37 L14.99 13.37 L14.83 13.5 L14.27 14.25 L13.71 14.86 L13.61 14.91 L13.4 14.91 L12.09 14.3 L11.4 13.85 L10.84 13.4 L9.89 12.39 L9.33 11.61 L9.06 11.14 L9.06 10.9 L9.86 9.94 L10.05 9.57 L10.05 9.28 L8.93 6.64 L8.66 6.43 L7.71 6.41 L7.34 6.54ZM20.15 3.16 L19.3 2.45 L18.13 1.65 L17.01 1.06 L16.03 0.66 L14.75 0.29 L13.74 0.11 L12.62 0.0 L11.51 0.0 L10.21 0.13 L9.14 0.35 L8.24 0.61 L6.99 1.12 L5.9 1.7 L5.1 2.23 L4.2 2.95 L3.38 3.75 L2.31 5.05 L1.57 6.25 L1.22 6.94 L0.82 7.92 L0.56 8.77 L0.32 9.83 L0.16 11.24 L0.16 12.54 L0.32 13.95 L0.58 15.12 L0.88 16.03 L1.36 17.14 L1.73 17.81 L1.73 17.94 L0.05 24.0 L6.27 22.35 L6.38 22.35 L7.15 22.75 L8.0 23.1 L8.82 23.36 L10.15 23.65 L11.38 23.79 L12.76 23.79 L14.41 23.57 L15.47 23.31 L16.32 23.02 L17.01 22.72 L17.94 22.25 L18.63 21.82 L19.4 21.26 L20.15 20.62 L20.76 20.01 L21.58 19.03 L22.25 18.05 L22.8 17.01 L23.23 16.0 L23.52 15.1 L23.81 13.74 L23.95 12.44 L23.95 11.35 L23.84 10.21 L23.6 8.98 L23.28 7.92 L22.86 6.88 L22.41 6.01 L21.66 4.86 L21.02 4.07ZM18.76 4.6 L19.56 5.42 L20.15 6.17 L20.6 6.86 L20.97 7.55 L21.37 8.48 L21.61 9.22 L21.82 10.15 L21.95 11.27 L21.95 12.49 L21.87 13.29 L21.74 14.03 L21.4 15.23 L20.94 16.29 L20.47 17.14 L19.91 17.94 L19.35 18.6 L18.21 19.67 L17.44 20.23 L16.72 20.65 L15.95 21.02 L15.1 21.34 L14.11 21.61 L12.78 21.79 L11.85 21.82 L10.79 21.74 L9.89 21.58 L9.09 21.37 L8.21 21.05 L7.23 20.57 L6.67 20.23 L2.92 21.18 L2.92 21.0 L3.88 17.51 L3.35 16.66 L3.0 15.97 L2.71 15.26 L2.42 14.3 L2.23 13.34 L2.15 12.62 L2.13 11.67 L2.18 10.84 L2.31 9.97 L2.5 9.2 L3.03 7.76 L3.72 6.51 L4.73 5.21 L5.58 4.39 L6.33 3.8 L7.26 3.22 L8.05 2.82 L8.72 2.55 L9.81 2.23 L10.66 2.07 L11.46 1.99 L12.68 1.99 L13.63 2.1 L14.72 2.34 L15.47 2.58 L16.24 2.9 L17.22 3.43 L17.97 3.93Z" />
    </svg>
  );
}

/**
 * Butang bulat hijau dengan logo WhatsApp. Terus membuka chat KOL (telefon atau WhatsApp Web).
 * compact: untuk jadual (sebaris dengan nama).
 */
export function WhatsAppButton({ phone, message, compact, name, className = "" }: { phone: string | null; message?: string; compact?: boolean; name?: string; className?: string }) {
  if (!phone) return null;
  const label = name ? `WhatsApp ${name}` : "Buka chat WhatsApp";
  return (
    <a
      href={waLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={`inline-grid shrink-0 place-items-center rounded-full bg-[#25D366] text-white transition hover:bg-[#1ebe5b] hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#25D366]/40 focus-visible:outline-none ${compact ? "size-[22px]" : "size-8"} ${className}`}
    >
      <WhatsAppGlyph className={compact ? "size-3.5" : "size-[18px]"} />
    </a>
  );
}
