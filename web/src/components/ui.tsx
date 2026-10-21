import { clsx } from "clsx";
import { LoaderCircle, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

// ─── Button ───────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-110",
  secondary: "bg-surface border border-line text-fg hover:bg-surface-2",
  ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg",
  danger: "bg-bad text-white hover:brightness-110",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
};

/** Classes do botão, reutilizáveis em <Link> (evita <button> dentro de <a>). */
export function buttonClasses(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md", className?: string) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition",
    "disabled:cursor-not-allowed disabled:opacity-60",
    size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
    buttonVariants[variant],
    className,
  );
}

export function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx("rounded-xl border border-line bg-surface", className)}>{children}</section>;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

// ─── Form fields ──────────────────────────────────────

type FieldProps = { label: string; hint?: ReactNode; error?: string; children: (id: string, describedBy?: string) => ReactNode };

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-bad">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const controlClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 aria-[invalid=true]:border-bad";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(controlClass, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(controlClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

// ─── Feedback ─────────────────────────────────────────

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-fg-2">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-fg-2">{icon}</div>
      <div>
        <h3 className="font-semibold text-fg">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

// ─── Segmented control (filtros de período) ───────────

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "h-8 rounded-md px-3 text-sm font-medium transition",
            value === option.value ? "bg-surface-2 text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // clique no backdrop
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 text-fg shadow-xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
