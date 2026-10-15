"use client";

import { useId } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ConfirmForm({
  action,
  confirm,
  submit,
  children,
}: {
  action: (form: FormData) => void | Promise<void>;
  confirm: string;
  submit: string;
  children?: React.ReactNode;
}) {
  const formId = `confirm-${useId().replace(/:/g, "")}`;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <form id={formId} action={action} className="flex flex-wrap items-end gap-2">
        {children}
      </form>
      <AlertDialog>
        <AlertDialogTrigger render={<button className="h-10 rounded-lg border bg-background px-3 text-sm" type="button" />}>
          {submit}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm this change</AlertDialogTitle>
            <AlertDialogDescription>{confirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={formId}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
