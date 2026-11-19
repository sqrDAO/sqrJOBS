import { useEffect, useRef, type ReactNode } from "react";

/** A native modal `<dialog>`, opened with showModal() while `open` is true. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  id,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  id: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={`${id}-title`} onClose={onClose}>
      <div className="dialog__head">
        <h2 id={`${id}-title`}>{title}</h2>
        <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}
