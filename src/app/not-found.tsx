import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Halaman tidak dijumpai</h1>
        <p className="mt-2 text-sm text-muted">Pautan mungkin salah atau rekod telah dipadam.</p>
        <Link href="/" className="btn-primary mt-6">Kembali ke Dashboard</Link>
      </div>
    </main>
  );
}
