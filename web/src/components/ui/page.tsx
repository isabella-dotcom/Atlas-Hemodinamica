import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap gap-1 text-xs text-[var(--muted)]">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <span>/</span> : null}
                {item.href ? (
                  <Link href={item.href} className="hover:text-[var(--accent)]">
                    {item.label}
                  </Link>
                ) : (
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
    >
      {message}
    </div>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label}>
      <div className="h-10 animate-pulse rounded-md bg-[var(--surface-2)]" />
      <div className="h-32 animate-pulse rounded-md bg-[var(--surface-2)]" />
      <div className="h-32 animate-pulse rounded-md bg-[var(--surface-2)]" />
    </div>
  );
}

export function PermissionGuard({
  allowed,
  children,
  fallback = null,
}: {
  allowed: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition",
        variant === "primary" && "bg-[var(--accent)] text-white hover:opacity-90",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]",
        variant === "danger" &&
          "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
        className,
      )}
    >
      {children}
    </Link>
  );
}
