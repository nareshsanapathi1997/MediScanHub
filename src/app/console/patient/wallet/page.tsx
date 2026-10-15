import { requireSession } from "@/server/session";
import { getWallet } from "@/lib/services/patient-extras";
import { formatInr, formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { PageHeader, EmptyState } from "@/components/widgets";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <WalletBody />
    </Gate>
  );
}

async function WalletBody() {
  const { actor } = await requireSession();
  const { wallet, transactions } = await getWallet(actor);
  return (
    <>
      <PageHeader eyebrow="Loyalty" title="Care wallet" description="Earn 1% back on captured online payments. Redeem at checkout or ask finance to apply balance to an open invoice." />
      <p className="rounded-2xl border bg-card p-4 text-2xl font-display">{formatInr(wallet.balancePaise)} available</p>
      {transactions.length === 0 ? <EmptyState title="No activity" body="Wallet credits appear after you pay for a booking online." /> : (
        <ul className="grid gap-2 text-sm">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex justify-between rounded-xl border px-3 py-2">
              <span>{tx.reason} · {formatWhen(tx.createdAt)}</span>
              <span className={tx.amountPaise >= 0 ? "text-primary" : ""}>{formatInr(tx.amountPaise)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
