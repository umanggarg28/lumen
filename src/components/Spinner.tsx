export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <span
        className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        aria-hidden
      />
      {label}
    </span>
  );
}
