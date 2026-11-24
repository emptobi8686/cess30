/** Fixed, sandboxed embed for allow-listed providers (P9). The src always comes from embedUrlFor(). */
export function VideoEmbed({ embedUrl, title }: { embedUrl: string; title: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
      <iframe
        src={embedUrl}
        title={title}
        className="absolute inset-0 h-full w-full"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
        allowFullScreen
      />
    </div>
  );
}
