/**
 * Semua ralat yang dijangka dilempar sebagai AppError dengan kod tetap.
 * Kod ini dipulangkan ke browser bersama requestId, jadi mudah dikesan dalam log.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "BAD_REQUEST"
  | "CONFIG"
  | "INTERNAL";

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  BAD_REQUEST: 400,
  CONFIG: 500,
  INTERNAL: 500,
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Sesi tamat. Sila log masuk semula.",
  FORBIDDEN: "Anda tiada kebenaran untuk tindakan ini.",
  NOT_FOUND: "Rekod tidak dijumpai.",
  VALIDATION: "Sila semak semula maklumat yang diisi.",
  CONFLICT: "Rekod ini telah diubah oleh orang lain. Muat semula halaman dan cuba lagi.",
  INVALID_TRANSITION: "Tindakan ini tidak dibenarkan pada status semasa.",
  BAD_REQUEST: "Permintaan tidak sah.",
  CONFIG: "Tetapan server tidak lengkap. Hubungi Admin sistem.",
  INTERNAL: "Ralat sistem. Sila cuba lagi atau hubungi Admin dengan kod rujukan.",
};

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fields?: FieldErrors;
  /** Maklumat tambahan untuk log sahaja (tidak dihantar ke browser). */
  readonly internal?: unknown;

  constructor(code: ErrorCode, message?: string, opts: { fields?: FieldErrors; internal?: unknown } = {}) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = "AppError";
    this.code = code;
    this.fields = opts.fields;
    this.internal = opts.internal;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
