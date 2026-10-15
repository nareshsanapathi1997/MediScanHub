import { contactAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";
import { currentSession } from "@/server/session";

export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const session = await currentSession();
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-10">
      <PageHeader eyebrow="Contact" title="Write to the desk" description="Signed-in users open a ticket on their account. Everyone else reaches the support inbox. Do not include report values in this form." />
      <FormBox action={contactAction} submit="Send message" success="Message received. A person will reply from the support queue.">
        {session ? null : (
          <>
            <label className="field">Name<input name="name" required /></label>
            <label className="field">Email<input name="email" type="email" required /></label>
          </>
        )}
        <label className="field">Subject<input name="subject" required /></label>
        <label className="field">Message<textarea name="body" required rows={5} /></label>
      </FormBox>
    </main>
  );
}
