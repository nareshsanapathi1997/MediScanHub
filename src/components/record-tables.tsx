"use client";

import { useMemo } from "react";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { DataTable } from "@/components/data-table";
import { StatusPill } from "@/components/widgets";

export function BookingTable({ rows }: { rows: Array<{ href: string; code: string; patient: string; status: string; when: string; total: string; visit: string }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <a className="text-primary" href={row.original.href}>{row.original.code}</a> },
    { accessorKey: "patient", header: "Patient" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill value={row.original.status} /> },
    { accessorKey: "visit", header: "Visit", cell: ({ row }) => row.original.visit.toLowerCase().replaceAll("_", " ") },
    { accessorKey: "when", header: "When" },
    { accessorKey: "total", header: "Total" },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search this page" facet={{ key: "status", label: "Statuses" }} pageSize={20} />;
}

export function UserTable({ rows }: { rows: Array<{ name: string; email: string; status: string; roles: string }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill value={row.original.status} /> },
    { accessorKey: "roles", header: "Roles" },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search name or email" facet={{ key: "status", label: "Statuses" }} />;
}

export function AuditTable({ rows }: { rows: Array<{ when: string; actor: string; action: string; entity: string; tenant: string }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "when", header: "When" },
    { accessorKey: "actor", header: "Actor" },
    { accessorKey: "action", header: "Action" },
    { accessorKey: "entity", header: "Entity" },
    { accessorKey: "tenant", header: "Center" },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search audit" facet={{ key: "action", label: "Actions" }} pageSize={15} />;
}

export function InvoiceTable({ rows }: { rows: Array<{ number: string; patient: string; status: string; total: string; booking: string }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "number", header: "Invoice" },
    { accessorKey: "patient", header: "Patient" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill value={row.original.status} /> },
    { accessorKey: "total", header: "Total" },
    { accessorKey: "booking", header: "Booking" },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search invoice or patient" facet={{ key: "status", label: "Statuses" }} />;
}

export function SampleTable({ rows }: { rows: Array<{ href: string; barcode: string; test: string; patient: string; branch: string; status: string; assignee: string; age: string; ageSort: number }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "barcode", header: "Barcode", cell: ({ row }) => <a className="font-mono text-xs font-medium text-primary" href={row.original.href}>{row.original.barcode}</a> },
    { accessorKey: "test", header: "Test" },
    { accessorKey: "patient", header: "Patient" },
    { accessorKey: "branch", header: "Branch" },
    { accessorKey: "assignee", header: "Assigned to" },
    { accessorKey: "ageSort", header: "Opened", cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.age}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill value={row.original.status} /> },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search barcode, test, or patient" facet={{ key: "status", label: "Statuses" }} empty="No samples match. Confirmed lab bookings open a sample with a barcode." />;
}

export function ReportTable({ rows }: { rows: Array<{ href: string; code: string; title: string; patient: string; status: string; updated: string; updatedSort: number }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "code", header: "Booking", cell: ({ row }) => <a className="font-medium text-primary" href={row.original.href}>{row.original.code}</a> },
    { accessorKey: "title", header: "Report" },
    { accessorKey: "patient", header: "Patient" },
    { accessorKey: "updatedSort", header: "Updated", cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.updated}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill value={row.original.status} /> },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search booking or patient" facet={{ key: "status", label: "Statuses" }} empty="No reports yet." />;
}
