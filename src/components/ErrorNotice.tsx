import { TriangleAlert } from "lucide-react";
import type { ApiError } from "@/lib/client/api";

/** Papar ralat dengan kod rujukan (requestId) supaya mudah dikesan dalam Log Sistem. */
export function ErrorNotice({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p>{error.message}</p>
        {error.requestId && (
          <p className="mt-1 text-xs text-red-700/80">
            Kod rujukan: <span className="font-mono select-all">{error.requestId}</span>
          </p>
        )}
      </div>
    </div>
  );
}
