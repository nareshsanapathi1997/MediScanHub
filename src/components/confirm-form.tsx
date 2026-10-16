"use client";

import { buttonVariants } from "@/components/ui/button";

import { useId } from "react";
import { ActionForm } from "@/components/action-form";
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
  variant = "outline",
}: {
  action: (form: FormData) => void | Promise<void>;
  confirm: string;
  submit: string;
  children?: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | "secondary";
}) {
  const formId = `confirm-${useId().replace(/:/g, "")}`;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <ActionForm id={formId} action={action} className="flex flex-wrap items-end gap-2">
        {children}
      </ActionForm>
      <AlertDialog>
        <AlertDialogTrigger render={<button className={buttonVariants({ variant, className: "h-10" })} type="button" />}>
          {submit}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm this change</AlertDialogTitle>
            <AlertDialogDescription>{confirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={formId} variant={variant === "destructive" ? "destructive" : "default"}>{submit}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
