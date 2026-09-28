import "server-only";
import { isDemo } from "../demo-mode";
import { adminBucket } from "../firebase/admin";

const g = globalThis as unknown as { __iyaDemoFiles?: Map<string, Buffer> };
const mem = () => (g.__iyaDemoFiles ??= new Map());

export async function putObject(path: string, data: Buffer, contentType: string): Promise<void> {
  if (isDemo()) {
    mem().set(path, data);
    return;
  }
  await adminBucket().file(path).save(data, { contentType, resumable: false, metadata: { cacheControl: "private, max-age=0" } });
}

export async function getObject(path: string): Promise<Buffer> {
  if (isDemo()) {
    const b = mem().get(path);
    if (!b) throw new Error(`[demo] fail ${path} tiada (data demo hilang bila server restart)`);
    return b;
  }
  const [buf] = await adminBucket().file(path).download();
  return buf;
}
