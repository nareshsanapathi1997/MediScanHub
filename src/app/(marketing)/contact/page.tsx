import Link from "next/link";
import { contactAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { SchemaForm } from "@/components/schema-form";
import { PageHero } from "@/components/marketing/page-hero";
import { currentSession } from "@/server/session";

export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const session = await currentSession();
  return (
    <main>
      <PageHero
        eyebrow="Contact"
        title="Contact us"
        description="Write to us about bookings, payments or reports. We reply within 1 working day. Please do not type your test results here."
        pageKey="contact"
        imageAlt="Clinic reception desk ready for patient support"
      />
      <div className="home-canvas">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:py-10 lg:grid-cols-[1fr_20rem]">
          <div className="surface p-6 sm:p-8">
            {session ? (
              <FormBox action={contactAction} submit="Send message" success="Thank you. We have your message and will reply within 1 working day.">
                <label className="field">Subject<input name="subject" required minLength={3} /></label>
                <label className="field">Message<textarea name="body" required minLength={10} rows={5} /></label>
              </FormBox>
            ) : (
              <SchemaForm
                schema="contact"
                action={contactAction}
                submit="Send message"
                success="Thank you. We have your message and will reply within 1 working day."
                fields={[
                  { name: "name", label: "Name", autoComplete: "name" },
                  { name: "email", label: "Email", type: "email", autoComplete: "email" },
                  { name: "subject", label: "Subject" },
                  { name: "body", label: "Message", type: "textarea", rows: 5 },
                ]}
              />
            )}
          </div>
          <aside className="grid content-start gap-4 rounded-2xl border bg-card/90 p-6 text-sm">
            <p className="font-display text-lg">Other ways to get help</p>
            <p className="text-muted-foreground">For a booking, call the center directly. Its phone number is on the center page and in your booking.</p>
            <p className="text-muted-foreground">For report questions, please talk to your doctor. We cannot explain results.</p>
            <Link href="/faq" className="font-medium text-primary hover:underline">Read common questions</Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
