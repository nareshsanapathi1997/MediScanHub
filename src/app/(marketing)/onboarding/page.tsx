import { centerRegisterAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { StickyInput, StickyTextarea } from "@/components/sticky-field";
import { LocationPicker } from "@/components/location-picker";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Register a center" };

export default function OnboardingPage() {
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-10">
      <PageHeader eyebrow="Centers" title="Apply to join the directory" description="The center stays pending until a platform admin reviews the verification documents. You can upload those after sign-in." />
      <FormBox action={centerRegisterAction} submit="Submit application">
        <label className="field">Your name<StickyInput name="ownerName" required autoComplete="name" /></label>
        <label className="field">Work email<StickyInput name="email" type="email" required autoComplete="email" /></label>
        <label className="field">Phone<StickyInput name="phone" required autoComplete="tel" /></label>
        <label className="field">Password<StickyInput name="password" type="password" required autoComplete="new-password" minLength={10} /></label>
        <p className="text-xs text-muted-foreground">At least 10 characters with upper, lower, and a number.</p>
        <label className="field">Center name<StickyInput name="centerName" required /></label>
        <label className="field">Legal name<StickyInput name="legalName" required /></label>
        <label className="field">Public slug<StickyInput name="slug" required placeholder="apex-diagnostics" /></label>
        <LocationPicker required />
        <label className="field">Address<StickyTextarea name="address" required rows={3} /></label>
        <label className="field">GSTIN<StickyInput name="gstin" /></label>
      </FormBox>
    </main>
  );
}
