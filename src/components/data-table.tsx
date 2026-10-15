"use client";

import { useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useLegacyTable, type LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DataTable<T extends Record<string, unknown>>({ columns, data, searchPlaceholder = "Search this page" }: { columns: LegacyColumnDef<T, unknown>[]; data: T[]; searchPlaceholder?: string }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useLegacyTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 8 } },
  });
  return (
    <div className="grid gap-3">
      <Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-10 max-w-sm" />
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button type="button" className="font-medium" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length || 1}>Nothing matches that filter.</TableCell></TableRow>
            ) : table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>{table.getFilteredRowModel().rows.length} rows</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
        </div>
      </div>
    </div>
  );
}
