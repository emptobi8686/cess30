"use client";

/** Last-resort boundary for errors in the root layout; must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>BLUEPRINT is temporarily unavailable.</h1>
        <p>Please try again in a moment{error.digest ? ` (reference ${error.digest})` : ""}.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
