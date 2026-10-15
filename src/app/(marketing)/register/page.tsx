"use client";

import Link from "next/link";
import { useState } from "react";
import { registerAction } from "@/server/actions";
import { FieldError, FormBox, useFormBoxState } from "@/components/form-box";
import { StickyInput, StickySelect } from "@/components/sticky-field";
import { LocationPicker } from "@/components/location-picker";
import { PageHeader } from "@/components/widgets";
import { PASSWORD_POLICY_MESSAGE, passwordMeetsPolicy } from "@/lib/password-policy";

function RegisterFields() {
  const state = useFormBoxState();
  const [password, setPassword] = useState("");
  const serverPasswordMsg = state.field === "password" ? state.error : "";
  const valid = password.length > 0 && passwordMeetsPolicy(password);
  const localPasswordMsg = !serverPasswordMsg && password.length > 0 && !valid ? PASSWORD_POLICY_MESSAGE : "";

  return (
    <>
      <label className="field">Full name<StickyInput name="name" required autoComplete="name" /></label>
      <label className="field">Email<StickyInput name="email" type="email" required autoComplete="email" /></label>
      <FieldError name="email" />
      <label className="field">Phone<StickyInput name="phone" required autoComplete="tel" /></label>
      <label className="field">Date of birth<StickyInput name="dateOfBirth" type="date" required /></label>
      <label className="field">Sex
        <StickySelect name="sex" defaultValue="FEMALE">
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
          <option value="INTERSEX">Intersex</option>
          <option value="UNKNOWN">Prefer not to say</option>
        </StickySelect>
      </label>
      <LocationPicker required saved={state.fields} />
      <label className="field">
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="h-10 w-full rounded-lg border bg-background px-3"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onInput={(event) => setPassword(event.currentTarget.value)}
          aria-describedby="password-policy"
          aria-invalid={Boolean(localPasswordMsg || serverPasswordMsg)}
        />
      </label>
      {localPasswordMsg || serverPasswordMsg ? (
        <p id="password-policy" className="text-xs text-destructive" role="alert">
          {serverPasswordMsg || localPasswordMsg}
        </p>
      ) : valid ? (
        <p id="password-policy" className="text-xs text-primary">
          Password meets the requirements.
        </p>
      ) : (
        <p id="password-policy" className="text-xs text-muted-foreground">
          Requirements: 10+ characters, one uppercase letter, one lowercase letter, and one number.
        </p>
      )}
    </>
  );
}

export default function RegisterPage() {
  return (
    <main className="mx-auto grid max-w-md gap-6 px-4 py-10">
      <PageHeader eyebrow="Patients" title="Create an account" description="This is for patients. Centers register separately." />
      <FormBox action={registerAction} submit="Create account">
        <RegisterFields />
      </FormBox>
      <p className="text-sm"><Link className="text-primary" href="/onboarding">Register a diagnostic center</Link></p>
    </main>
  );
}
