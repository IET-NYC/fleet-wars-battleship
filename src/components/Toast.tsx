interface ToastProps {
  text: string;
  onDismiss: () => void;
}

export default function Toast({ text, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss: ${text}`}
        className="pointer-events-auto max-w-md rounded border border-cognition/50 bg-plating/95 px-4 py-2 text-center text-xs text-slate-100 shadow-lg shadow-black/50 motion-safe:animate-toast-in"
      >
        {text}
      </button>
    </div>
  );
}
