import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import type { SessionUser } from "../domain/types";
import { AppError, HTTP_STATUS, isAppError, type FieldErrors } from "./errors";
import { log, persistError } from "./logger";
import { getSessionUser } from "./session";

/**
 * Pembalut untuk SEMUA API route. Ia buat perkara yang sama setiap kali:
 *  1. Jana requestId (dipulangkan dalam respons dan header x-request-id)
 *  2. Sekat permintaan cross-site untuk POST/PATCH/DELETE
 *  3. Semak sesi dan peranan
 *  4. Tukar sebarang ralat kepada JSON { ok:false, error:{ code, message, requestId } }
 *  5. Log satu baris JSON untuk setiap permintaan
 *
 * Bila pengguna lapor masalah, minta "Kod rujukan" yang dipapar di skrin, kemudian
 * cari kod itu di Log Sistem (Admin) atau Vercel Logs.
 */

type Access = "public" | "user" | "admin";
type Ctx<P, U> = { req: NextRequest; params: P; requestId: string; user: U };
type RouteContext<P> = { params: Promise<P> };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function newRequestId(): string {
  return randomBytes(6).toString("hex");
}

function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) throw new AppError("FORBIDDEN", "Permintaan ditolak (origin tiada).");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Permintaan ditolak (origin tidak sah).");
  }
  if (originHost !== host) throw new AppError("FORBIDDEN", "Permintaan ditolak (cross-site).");
}

function wrap<P, U>(access: Access, fn: (ctx: Ctx<P, U>) => Promise<unknown>) {
  return async (req: NextRequest, context: RouteContext<P>): Promise<Response> => {
    const requestId = newRequestId();
    const started = Date.now();
    const route = req.nextUrl.pathname;
    let userId: string | null = null;

    try {
      if (MUTATING.has(req.method)) assertSameOrigin(req);

      let user: SessionUser | null = null;
      if (access !== "public") {
        user = await getSessionUser();
        if (!user) throw new AppError("UNAUTHENTICATED");
        if (access === "admin" && user.role !== "admin") throw new AppError("FORBIDDEN");
      } else {
        user = await getSessionUser().catch(() => null);
      }
      userId = user?.id ?? null;

      const params = (context?.params ? await context.params : {}) as P;
      const result = await fn({ req, params, requestId, user: user as U });

      const res = result instanceof Response ? result : NextResponse.json({ ok: true, data: result ?? null, requestId });
      res.headers.set("x-request-id", requestId);
      log("info", "api", { requestId, method: req.method, route, status: res.status, ms: Date.now() - started, userId });
      return res;
    } catch (err) {
      return errorResponse(err, { requestId, method: req.method, route, userId, started });
    }
  };
}

export async function errorResponse(
  err: unknown,
  meta: { requestId: string; method: string; route: string; userId: string | null; started: number },
): Promise<Response> {
  const appErr = isAppError(err) ? err : new AppError("INTERNAL", undefined, { internal: err });
  const status = HTTP_STATUS[appErr.code];
  const internal = appErr.internal ?? (isAppError(err) ? undefined : err);
  const detail = internal instanceof Error ? internal.message : internal !== undefined ? String(internal) : appErr.message;

  log(status >= 500 ? "error" : "warn", "api_error", {
    requestId: meta.requestId,
    method: meta.method,
    route: meta.route,
    status,
    code: appErr.code,
    detail,
    userId: meta.userId,
    ms: Date.now() - meta.started,
  });

  if (status >= 500) {
    await persistError({
      requestId: meta.requestId,
      code: appErr.code,
      message: detail,
      route: meta.route,
      method: meta.method,
      userId: meta.userId,
      stack: internal instanceof Error ? internal.stack : undefined,
    });
  }

  return NextResponse.json(
    { ok: false, error: { code: appErr.code, message: appErr.message, fields: appErr.fields, requestId: meta.requestId } },
    { status, headers: { "x-request-id": meta.requestId } },
  );
}

export const publicRoute = <P = Record<string, never>>(fn: (ctx: Ctx<P, SessionUser | null>) => Promise<unknown>) =>
  wrap<P, SessionUser | null>("public", fn);
export const userRoute = <P = Record<string, never>>(fn: (ctx: Ctx<P, SessionUser>) => Promise<unknown>) =>
  wrap<P, SessionUser>("user", fn);
export const adminRoute = <P = Record<string, never>>(fn: (ctx: Ctx<P, SessionUser>) => Promise<unknown>) =>
  wrap<P, SessionUser>("admin", fn);

/** Sahkan objek dengan zod; jika gagal, lempar VALIDATION dengan ralat per medan. */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".").replace(/^data\./, "") || "_";
    fields[key] ??= issue.message;
  }
  throw new AppError("VALIDATION", undefined, { fields });
}

const MAX_BODY = 64_000;

export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.output<S>> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    throw new AppError("BAD_REQUEST", "Content-Type mesti application/json.");
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY) throw new AppError("BAD_REQUEST", "Data terlalu besar.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError("BAD_REQUEST", "Format JSON tidak sah.");
  }
  return parseOrThrow(schema, body);
}
