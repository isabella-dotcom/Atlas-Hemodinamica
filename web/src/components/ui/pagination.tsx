import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(nextPage: number) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && key !== "page") params.set(key, value);
    });
    params.set("page", String(nextPage));
    params.set("pageSize", String(pageSize));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm">
      <p className="text-[var(--muted)]">
        Página {page} de {totalPages} · {total} registro(s)
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={page <= 1}
          className={cn(
            "rounded-md border border-[var(--border)] px-3 py-1.5",
            page <= 1 && "pointer-events-none opacity-40",
          )}
          href={hrefFor(Math.max(1, page - 1))}
        >
          Anterior
        </Link>
        <Link
          aria-disabled={page >= totalPages}
          className={cn(
            "rounded-md border border-[var(--border)] px-3 py-1.5",
            page >= totalPages && "pointer-events-none opacity-40",
          )}
          href={hrefFor(Math.min(totalPages, page + 1))}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}
