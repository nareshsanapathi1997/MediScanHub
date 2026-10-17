import { centerRegisterAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { StickyInput, StickyTextarea } from "@/components/sticky-field";
import { LocationPicker } from "@/components/location-picker";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Register a center" };

export default function OnboardingPage() {
  return (
    <AuthShell eyebrow="Centers" title="List your diagnostic center" description="Fill in your details. Our team checks your documents (NABL/registration certificate, GST) and approves your center, usually within 2 working days." wide>
      <FormBox action={centerRegisterAction} submit="Submit application">
        <label className="field">Your name<StickyInput name="ownerName" required autoComplete="name" /></label>
        <label className="field">Work email<StickyInput name="email" type="email" required autoComplete="email" /></label>
        <label className="field">Mobile number<StickyInput name="phone" required autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" /></label>
        <label className="field">Password<StickyInput name="password" type="password" required autoComplete="new-password" minLength={10} /></label>
        <p className="text-xs text-muted-foreground">Use at least 10 characters with a capital letter, a small letter and a number.</p>
        <label className="field">Center name<StickyInput name="centerName" required /></label>
        <label className="field">Registered business name<StickyInput name="legalName" required /></label>
        <label className="field">Web address name<StickyInput name="slug" required placeholder="apex-diagnostics" /></label>
        <LocationPicker required />
        <label className="field">Address<StickyTextarea name="address" required rows={3} /></label>
        <label className="field">GSTIN (optional)<StickyInput name="gstin" placeholder="36ABCDE1234F1Z5" /></label>
      </FormBox>
    </AuthShell>
  );
}
