"use client";

import { toast as sonnerToast, type ExternalToast } from "sonner";

type Variant = "default" | "success" | "error" | "destructive" | "warning" | "info";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: Variant;
  duration?: number;
  action?: ExternalToast["action"];
};

function toast(input: ToastInput | string) {
  if (typeof input === "string") return sonnerToast(input);
  const { title, description, variant, duration, action } = input;
  const message = (title ?? "") as string;
  const opts: ExternalToast = { description: description as string, duration, action };
  switch (variant) {
    case "success":
      return sonnerToast.success(message, opts);
    case "error":
    case "destructive":
      return sonnerToast.error(message, opts);
    case "warning":
      return sonnerToast.warning(message, opts);
    case "info":
      return sonnerToast.info(message, opts);
    default:
      return sonnerToast(message, opts);
  }
}

function useToast() {
  return {
    toast,
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
    toasts: [] as never[],
  };
}

export { useToast, toast };
