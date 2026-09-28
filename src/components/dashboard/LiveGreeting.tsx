"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatLongDateMs, nowMYT } from "@/lib/domain/dates";

function greetingFor(hour: number): string {
  if (hour < 12) return "Selamat pagi";
  if (hour < 15) return "Selamat tengah hari";
  if (hour < 19) return "Selamat petang";
  return "Selamat malam";
}


/**
 * Ucapan, tarikh dan masa (waktu Malaysia) yang berubah sendiri.
 * Nilai awal datang dari server supaya tiada "lompatan" semasa halaman dimuat.
 */
export function LiveGreeting({ name, initial }: { name: string; initial: { ymd: string; hm: string; hour: number } }) {
  const [t, setT] = useState(initial);
  useEffect(() => {
    const tick = () => setT(nowMYT());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greetingFor(t.hour)}, {name}</h1>
        <p className="mt-1 text-sm text-muted">Ini ringkasan aktiviti marketing hari ini.</p>
      </div>
      <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm">
        <CalendarDays className="size-4 text-brand-600" aria-hidden />
        <span>{formatLongDateMs(t.ymd)}</span>
        <span className="font-semibold tabular-nums text-brand-700">{t.hm}</span>
      </p>
    </div>
  );
}
