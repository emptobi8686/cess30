import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you were looking for doesn&apos;t exist or has moved.</p>
      <div className="flex justify-center gap-3 text-sm">
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Go to your dashboard
        </Link>
        <Link href="/" className="text-muted-foreground hover:underline">
          Home
        </Link>
      </div>
    </main>
  );
}
