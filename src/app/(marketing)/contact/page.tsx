import { contactAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { SchemaForm } from "@/components/schema-form";
import { PageHeader } from "@/components/widgets";
import { currentSession } from "@/server/session";

export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const session = await currentSession();
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-10">
      <PageHeader eyebrow="Contact" title="Contact us" description="Write to us about bookings, payments or reports. We reply within 1 working day. Please do not type your test results here." />
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
    </main>
  );
}
