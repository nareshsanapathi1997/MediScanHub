import Link from "next/link";
import { cn } from "@/lib/utils";

export type ListColumn = { key: string; label: string; align?: "left" | "right"; className?: string; hideOnMobile?: boolean };
export type ListRow = { id: string; href?: string; cells: Record<string, React.ReactNode>; actions?: React.ReactNode };

/**
 * Compact list for the "List" view. Table from md up; on phones, dense rows (title, key facts inline, actions)
 * rather than cards. The first column is the row title and links to `href` when given.
 */
export function ListView({ columns, rows, label, className }: { columns: ListColumn[]; rows: ListRow[]; label: string; className?: string }) {
  const [first, ...rest] = columns;
  if (!first) return null;
  const title = (row: ListRow) => row.href ? <Link href={row.href} className="font-medium hover:text-primary hover:underline">{row.cells[first.key]}</Link> : <span className="font-medium">{row.cells[first.key]}</span>;
  const hasActions = rows.some((row) => row.actions);
  return (
    <div className={cn("surface overflow-hidden", className)} data-list-view>
      <table className="hidden w-full text-sm md:table" aria-label={label}>
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {columns.map((column) => <th key={column.key} scope="col" className={cn("px-4 py-2.5 font-medium", column.align === "right" ? "text-right" : "text-left", column.className)}>{column.label}</th>)}
            {hasActions ? <th scope="col" className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-muted/30">
              <th scope="row" className={cn("px-4 py-3 text-left font-normal", first.className)}>{title(row)}</th>
              {rest.map((column) => <td key={column.key} className={cn("px-4 py-3 align-middle", column.align === "right" && "text-right tabular-nums", column.className)}>{row.cells[column.key]}</td>)}
              {hasActions ? <td className="px-4 py-3 text-right"><div className="flex flex-wrap items-center justify-end gap-2">{row.actions}</div></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y md:hidden" aria-label={label}>
        {rows.map((row) => (
          <li key={row.id} className="grid gap-1 px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">{title(row)}</div>
              {rest.filter((column) => column.align === "right").slice(0, 1).map((column) => <div key={column.key} className="shrink-0 text-right font-medium tabular-nums">{row.cells[column.key]}</div>)}
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {rest.filter((column, index) => !column.hideOnMobile && !(column.align === "right" && rest.findIndex((item) => item.align === "right") === index)).map((column) => (
                <span key={column.key}><span className="sr-only">{column.label}: </span>{row.cells[column.key]}</span>
              ))}
            </p>
            {row.actions ? <div className="mt-1 flex flex-wrap gap-2">{row.actions}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
