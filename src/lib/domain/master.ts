/**
 * Senarai yang boleh diubah Admin di halaman Tetapan (tanpa ubah kod).
 * Nilai di bawah hanya nilai AWAL bila sistem baru dipasang.
 */
export const MASTER_KEYS = ["campaignTypes", "platforms", "expenseCategories", "paymentMethods", "niches", "itemCategories", "outletKinds", "ideaTypes", "contentTypes", "assetKinds"] as const;
export type MasterKey = (typeof MASTER_KEYS)[number];
export type MasterLists = Record<MasterKey, string[]>;

export const MASTER_DEFAULTS: MasterLists = {
  campaignTypes: ["KOL", "Launch", "Live", "Affiliate", "Event", "Promotion", "Ads", "Seeding", "Food Review"],
  platforms: ["TikTok", "Instagram", "Facebook", "YouTube", "X", "Threads", "Lemon8", "Shopee", "Lazada", "Google", "Lain-lain"],
  expenseCategories: [
    "KOL",
    "Meta Ads",
    "Google Ads",
    "TikTok Ads",
    "Marketplace Ads",
    "Content Production",
    "Event",
    "Product & Sampling",
    "Makanan (review)",
    "Penghantaran",
    "Printing",
    "Affiliate",
    "Lain-lain",
  ],
  paymentMethods: ["Pindahan bank", "Kad kredit syarikat", "Petty cash", "Caj terus platform"],
  niches: ["F&B", "Food Review", "Beauty", "Skincare", "Lifestyle", "Family & Parenting", "Fashion", "Tech", "Automotive", "Travel", "Fitness", "Comedy"],
  itemCategories: ["Makanan", "Minuman", "Produk kecantikan", "Set / Bundle", "Servis"],
  outletKinds: ["Restoran", "Cawangan", "Kiosk", "Pop-up", "Gudang"],
  ideaTypes: ["Content Idea", "Campaign Idea", "KOL Idea", "Promotion Idea", "Event Idea", "TikTok Idea", "Live Idea"],
  contentTypes: [
    "UGC",
    "EGC",
    "CGC",
    "Expert Content",
    "Testimonial",
    "Product Demo",
    "Problem / Solution",
    "Educational",
    "Storytelling",
    "Trend",
    "Promotional",
    "Live Content",
    "KOL Content",
    "Whitelisted / Spark Ads",
  ],
  assetKinds: ["Video", "Gambar", "Poster", "Thumbnail", "Caption", "Script", "Raw footage", "Edited video", "Gambar produk", "KOL content", "Testimonial", "Bahan marketing"],
};

export const MASTER_INFO: Record<MasterKey, { title: string; hint: string }> = {
  campaignTypes: { title: "Jenis campaign", hint: "Dipapar dalam calendar dan borang campaign." },
  platforms: { title: "Platform", hint: "Untuk campaign dan akaun media sosial KOL." },
  expenseCategories: { title: "Kategori perbelanjaan / saluran", hint: "Juga digunakan untuk pecahan bajet ikut saluran." },
  paymentMethods: { title: "Kaedah bayaran", hint: "Untuk rekod perbelanjaan." },
  niches: { title: "Niche KOL", hint: "Satu KOL boleh ada beberapa niche." },
  itemCategories: { title: "Kategori item", hint: "Untuk Katalog Item." },
  outletKinds: { title: "Jenis outlet", hint: "Untuk senarai Outlet." },
  ideaTypes: { title: "Jenis idea", hint: "Untuk Idea Hub." },
  assetKinds: { title: "Jenis asset", hint: "Untuk Content Library (video, poster, raw footage...)." },
  contentTypes: { title: "Jenis content", hint: "UGC, EGC, Testimonial dan lain-lain. Untuk Content Bank." },
};

/** Nilai boleh diterima jika ada dalam senarai ATAU nilai lama rekod itu (supaya rekod lama masih boleh disimpan). */
export function notInList(values: string[], list: string[], existing: string[] = []): string[] {
  return values.filter((v) => v !== "" && !list.includes(v) && !existing.includes(v));
}
