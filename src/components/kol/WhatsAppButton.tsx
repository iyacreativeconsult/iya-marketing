import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/domain/whatsapp";

/** Butang hijau yang terus membuka chat WhatsApp KOL (telefon atau WhatsApp Web). */
export function WhatsAppButton({ phone, message, compact }: { phone: string | null; message?: string; compact?: boolean }) {
  if (!phone) return null;
  return (
    <a
      href={waLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      title="Buka chat WhatsApp"
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#25D366] font-semibold text-white shadow-sm transition-colors hover:bg-[#1ebe5b] ${compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"}`}
    >
      <MessageCircle className={compact ? "size-3.5" : "size-4"} aria-hidden /> WhatsApp
    </a>
  );
}
