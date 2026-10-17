import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { getWalletPage } from "@/lib/services/patient-extras";
import { formatInr, formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { PageHeader, EmptyState, Item, ItemList, Panel } from "@/components/widgets";
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from "lucide-react";

export const metadata = { title: "Wallet" };

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { actor } = await requireSession();
  const params = await searchParams;
  return (
    <Gate actor={actor} permission="patient.portal">
      <WalletBody params={params} />
    </Gate>
  );
}

async function WalletBody({ params }: { params: { page?: string } }) {
  const { actor } = await requireSession();
  const { wallet, items: transactions, total, earned: credits, used, args: paging } = await fetchPage(parsePage(params, 15), (args) => getWalletPage(actor, args));
  return (
    <>
      <PageHeader eyebrow="Wallet" title="My wallet" description="Get 1% back on every online payment. Use the money on your next booking at checkout." />
      <section aria-label="Balance" className="grid gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary to-[oklch(0.4_0.09_190)] p-6 text-primary-foreground shadow-sm sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm opacity-85"><WalletIcon className="size-4" aria-hidden />Available to use</p>
          <p className="mt-1 font-display text-4xl tabular-nums">{formatInr(wallet.balancePaise)}</p>
          <p className="mt-1 text-sm opacity-80">You can use it at checkout on your next booking.</p>
        </div>
        <dl className="grid grid-cols-2 gap-6 text-sm">
          <div><dt className="opacity-75">Earned</dt><dd className="font-medium tabular-nums">{formatInr(credits)}</dd></div>
          <div><dt className="opacity-75">Used</dt><dd className="font-medium tabular-nums">{formatInr(used)}</dd></div>
        </dl>
      </section>
      <Panel title="Activity" description="Credits and payments from your wallet.">
        {transactions.length === 0 ? <EmptyState title="No wallet activity yet" body="Wallet credits appear after you pay for a booking online." icon={WalletIcon} /> : (
          <ItemList>
            {transactions.map((tx) => (
              <Item key={tx.id} icon={tx.amountPaise >= 0 ? ArrowDownLeft : ArrowUpRight} tone={tx.amountPaise >= 0 ? "success" : "muted"} title={tx.reason} meta={formatWhen(tx.createdAt)} trailing={<span className={tx.amountPaise >= 0 ? "font-medium text-success tabular-nums" : "font-medium tabular-nums"}>{tx.amountPaise >= 0 ? "+" : "−"}{formatInr(Math.abs(tx.amountPaise))}</span>} />
            ))}
          </ItemList>
        )}
        {total > 0 ? <Pagination className="mt-9" pathname="/console/patient/wallet" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "entry" : "entries"} label="Wallet pages" /> : null}
      </Panel>
    </>
  );
}
