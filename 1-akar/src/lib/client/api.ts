/**
 * Semua panggilan API dari browser melalui fungsi ini supaya ralat sentiasa
 * mempunyai bentuk yang sama: { code, message, requestId, fields }.
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public requestId: string | null,
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown> | unknown[];

export async function api<T = unknown>(path: string, opts: { method?: string; body?: Json } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: opts.body ? { "content-type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("NETWORK", "Tidak dapat hubungi server. Semak sambungan internet.", null);
  }

  let json: { ok: boolean; data?: T; error?: { code: string; message: string; requestId: string; fields?: Record<string, string> } };
  try {
    json = await res.json();
  } catch {
    throw new ApiError("INTERNAL", `Respons server tidak sah (HTTP ${res.status}).`, res.headers.get("x-request-id"));
  }

  if (!json.ok || !res.ok) {
    const e = json.error ?? { code: "INTERNAL", message: `HTTP ${res.status}`, requestId: res.headers.get("x-request-id") ?? "" };
    if (e.code === "UNAUTHENTICATED" && !path.startsWith("/api/auth")) {
      window.location.assign("/login");
    }
    throw new ApiError(e.code, e.message, e.requestId || null, e.fields ?? {});
  }
  return json.data as T;
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError("CLIENT", e instanceof Error ? e.message : "Ralat tidak diketahui.", null);
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

/** Muat naik satu fail (resit, invois, bukti bayaran). Maksimum 4 MB. */
export async function uploadFile(file: File, teamId: string, purpose: "receipt" | "invoice" | "payment_proof" | "idea_image" | "asset", ownerId?: string): Promise<UploadedFile> {
  if (file.size > 4 * 1024 * 1024) throw new ApiError("VALIDATION", "Fail melebihi 4 MB.", null);
  const form = new FormData();
  form.set("file", file);
  form.set("teamId", teamId);
  form.set("purpose", purpose);
  if (ownerId) form.set("ownerId", ownerId);
  let res: Response;
  try {
    res = await fetch("/api/files", { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new ApiError("NETWORK", "Tidak dapat hubungi server. Semak sambungan internet.", null);
  }
  const json = await res.json().catch(() => null);
  if (!json?.ok) {
    const e = json?.error ?? { code: "INTERNAL", message: `HTTP ${res.status}`, requestId: res.headers.get("x-request-id") };
    throw new ApiError(e.code, e.fields?.file ?? e.message, e.requestId ?? null, e.fields ?? {});
  }
  return json.data as UploadedFile;
}
