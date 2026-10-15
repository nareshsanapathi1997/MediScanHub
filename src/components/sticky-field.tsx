"use client";

import { createContext, useContext, useEffect, useRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const FieldsContext = createContext<Record<string, string> | undefined>(undefined);

export function StickyFieldsProvider({ fields, children }: { fields?: Record<string, string>; children: React.ReactNode }) {
  return <FieldsContext.Provider value={fields}>{children}</FieldsContext.Provider>;
}

function useSavedValue(name: string) {
  const fields = useContext(FieldsContext);
  return fields?.[name];
}

export function StickyInput({ name, ...props }: InputHTMLAttributes<HTMLInputElement> & { name: string }) {
  const saved = useSavedValue(name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (saved === undefined || !ref.current) return;
    if (ref.current.value !== saved) ref.current.value = saved;
  }, [saved]);
  return <input ref={ref} name={name} {...props} />;
}

export function StickySelect({ name, children, defaultValue, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { name: string; children: React.ReactNode }) {
  const saved = useSavedValue(name);
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (saved === undefined || !ref.current) return;
    ref.current.value = saved;
  }, [saved]);
  return (
    <select ref={ref} name={name} defaultValue={defaultValue} {...props}>
      {children}
    </select>
  );
}

export function StickyTextarea({ name, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string }) {
  const saved = useSavedValue(name);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (saved === undefined || !ref.current) return;
    if (ref.current.value !== saved) ref.current.value = saved;
  }, [saved]);
  return <textarea ref={ref} name={name} {...props} />;
}
