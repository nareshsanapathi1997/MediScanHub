"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { DataTable } from "@/components/data-table";

export function BookingTable({ rows }: { rows: Array<{ href: string; code: string; patient: string; status: string; when: string; total: string; visit: string }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <Link className="text-primary" href={row.original.href}>{row.original.code}</Link> },
    { accessorKey: "patient", header: "Patient" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "visit", header: "Visit" },
    { accessorKey: "when", header: "When" },
    { accessorKey: "total", header: "Total" },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Filter bookings" />;
}

export function UserTable({ rows }: { rows: Array<{ name: string; email: string; status: string; roles: string }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "roles", header: "Roles" },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Filter users" />;
}

export function AuditTable({ rows }: { rows: Array<{ when: string; actor: string; action: string; entity: string; tenant: string }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "when", header: "When" },
    { accessorKey: "actor", header: "Actor" },
    { accessorKey: "action", header: "Action" },
    { accessorKey: "entity", header: "Entity" },
    { accessorKey: "tenant", header: "Center" },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Filter audit" />;
}

export function InvoiceTable({ rows }: { rows: Array<{ number: string; patient: string; status: string; total: string; booking: string }> }) {
  const columns = useMemo<LegacyColumnDef<(typeof rows)[number], unknown>[]>(() => [
    { accessorKey: "number", header: "Invoice" },
    { accessorKey: "patient", header: "Patient" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "total", header: "Total" },
    { accessorKey: "booking", header: "Booking" },
  ], []);
  return <DataTable columns={columns} data={rows} searchPlaceholder="Filter invoices" />;
}
