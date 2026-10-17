"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "@/components/icons";
import { flexRender } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useLegacyTable, type LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const titleCase = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Client table with global search, an optional facet filter (usually status), column sorting, and pagination.
 * Data arrives already authorized and tenant-scoped from the server.
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchPlaceholder = "Search",
  facet,
  pageSize = 10,
  empty = "Nothing matches that filter.",
}: {
  columns: LegacyColumnDef<T, unknown>[];
  data: T[];
  searchPlaceholder?: string;
  facet?: { key: keyof T & string; label: string };
  pageSize?: number;
  empty?: string;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [facetValue, setFacetValue] = useState("");
  const facetOptions = useMemo(() => (facet ? [...new Set(data.map((row) => String(row[facet.key] ?? "")))].filter(Boolean).sort() : []), [data, facet]);
  const rows = useMemo(() => (facet && facetValue ? data.filter((row) => String(row[facet.key]) === facetValue) : data), [data, facet, facetValue]);
  const table = useLegacyTable({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });
  const filtered = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: size } = table.getState().pagination;
  const from = filtered === 0 ? 0 : pageIndex * size + 1;
  const to = Math.min(filtered, (pageIndex + 1) * size);
  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={globalFilter} onChange={(event) => { setGlobalFilter(event.target.value); table.setPageIndex(0); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-10 pl-9" />
        </div>
        {facet ? (
          <select aria-label={`Filter by ${facet.label}`} value={facetValue} onChange={(event) => { setFacetValue(event.target.value); table.setPageIndex(0); }} className="h-10 rounded-lg border bg-card px-3 text-sm sm:w-48">
            <option value="">All {facet.label.toLowerCase()}</option>
            {facetOptions.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
          </select>
        ) : null}
      </div>
      {/* Phones get one card per row: the first column is the title, the rest are label and value pairs. */}
      <ul className="grid gap-2 md:hidden" aria-label="Results">
        {table.getRowModel().rows.length === 0 ? (
          <li className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">{empty}</li>
        ) : table.getRowModel().rows.map((row) => {
          const [first, ...rest] = row.getVisibleCells();
          return (
            <li key={row.id} className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
              {first ? <div className="font-medium">{flexRender(first.column.columnDef.cell, first.getContext())}</div> : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                {rest.map((cell) => (
                  <div key={cell.id} className="contents">
                    <dt className="text-xs text-muted-foreground">{typeof cell.column.columnDef.header === "string" ? cell.column.columnDef.header : cell.column.id}</dt>
                    <dd className="min-w-0 text-right break-words">{flexRender(cell.column.columnDef.cell, cell.getContext())}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" aria-hidden /> : sorted === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                        </button>
                      ) : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length || 1} className="py-10 text-center text-sm text-muted-foreground">{empty}</TableCell></TableRow>
            ) : table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span aria-live="polite">{from}–{to} of {filtered}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="size-4" aria-hidden />Previous</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next<ChevronRight className="size-4" aria-hidden /></Button>
        </div>
      </div>
    </div>
  );
}
