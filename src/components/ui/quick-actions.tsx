import * as React from "react";
import {
  X, Pencil, Trash2, Copy, RefreshCw, ChevronLeft, ChevronRight, Plus, Minus,
  Settings2,
} from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { cn } from "@/lib/utils";
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

type WrapperProps = Omit<ButtonProps, "variant" | "size"> & {
  label?: string;
};

function makeAction(
  defaults: {
    variant: ButtonProps["variant"];
    size: ButtonProps["size"];
    icon: React.ComponentType<{ className?: string }>;
    defaultLabel: string;
  },
  displayName: string,
) {
  const Component = React.forwardRef<HTMLButtonElement, WrapperProps>(
    ({ className, label, ...props }, ref) => {
      const Icon = defaults.icon;
      return (
        <Button
          ref={ref}
          type="button"
          variant={defaults.variant}
          size={defaults.size}
          aria-label={label ?? defaults.defaultLabel}
          title={label ?? defaults.defaultLabel}
          className={cn(className)}
          {...props}
        >
          <Icon />
        </Button>
      );
    },
  );
  Component.displayName = displayName;
  return Component;
}

/** Modal/dialog close. Ghost, neutral. */
export const CloseButton = makeAction(
  { variant: "ghost", size: "icon", icon: X, defaultLabel: "Close" },
  "CloseButton",
);

// ── Premium row-action chips (matches /admin/schedule look) ──────────────
// White card + colored border, fills on hover with inverted text, animated icon.

const ROW_ACTION_BASE =
  "h-8 w-8 p-0 font-body transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 [&_svg]:!scale-100 [&_svg]:!rotate-0";

type RowActionProps = Omit<ButtonProps, "variant" | "size" | "children"> & {
  label?: string;
};

/** Row edit — white card → sage fill on hover, pencil spins. */
export const EditButton = React.forwardRef<HTMLButtonElement, RowActionProps>(
  ({ className, label, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      aria-label={label ?? "Edit"}
      title={label ?? "Edit"}
      className={cn(
        ROW_ACTION_BASE,
        "border-sage/40 text-sage bg-white hover:!bg-sage hover:!text-white hover:!border-sage",
        className,
      )}
      {...props}
    >
      <AnimatedIcon icon={Pencil} size={14} animateOnMount={false} hover="wiggle" />
    </Button>
  ),
);
EditButton.displayName = "EditButton";

/** Row manage (settings/details) — same chip as Edit but with gear icon. */
export const ManageButton = React.forwardRef<HTMLButtonElement, RowActionProps>(
  ({ className, label, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      aria-label={label ?? "Manage"}
      title={label ?? "Manage"}
      className={cn(
        ROW_ACTION_BASE,
        "border-sage/40 text-sage bg-white hover:!bg-sage hover:!text-white hover:!border-sage",
        className,
      )}
      {...props}
    >
      <AnimatedIcon icon={Settings2} size={14} animateOnMount={false} hover="wiggle" />
    </Button>
  ),
);
ManageButton.displayName = "ManageButton";

type DeleteButtonProps = RowActionProps & {
  /** Skip the built-in confirmation prompt — opt out when the caller has its own. */
  skipConfirm?: boolean;
  /** Heading shown in the confirmation prompt. */
  confirmTitle?: string;
  /** Body text for the confirmation prompt. */
  confirmDescription?: string;
  /** Label for the destructive action in the prompt. */
  confirmActionLabel?: string;
};

/** Row delete — white card → terracotta fill on hover, trash wiggles.
 *  Wraps onClick in a confirmation dialog by default; pass `skipConfirm` to
 *  preserve flows that already prompt themselves. */
export const DeleteButton = React.forwardRef<HTMLButtonElement, DeleteButtonProps>(
  ({ className, label, onClick, skipConfirm, confirmTitle, confirmDescription, confirmActionLabel, ...props }, ref) => {
    const button = (
      <Button
        ref={ref}
        type="button"
        variant="outline"
        size="sm"
        aria-label={label ?? "Delete"}
        title={label ?? "Delete"}
        className={cn(
          ROW_ACTION_BASE,
          "border-terracotta/40 text-terracotta bg-white hover:!bg-terracotta hover:!text-white hover:!border-terracotta",
          className,
        )}
        {...(skipConfirm ? { onClick } : {})}
        {...props}
      >
        <AnimatedIcon icon={Trash2} size={14} animateOnMount={false} hover="wiggle" />
      </Button>
    );
    if (skipConfirm) return button;
    return (
      <AlertDialog>
        <AlertDialogTrigger
          asChild
          onClick={(e) => {
            // Prevent parent (row/card) click handlers from firing the dialog twice.
            e.stopPropagation();
          }}
        >
          {button}
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {confirmTitle ?? "Delete this item?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {confirmDescription ?? "This action can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-terracotta text-white hover:bg-terracotta/90"
              onClick={(e) => {
                // Fire the user-supplied handler. React synthetic events from
                // AlertDialogAction don't carry the original row context, but
                // the closure-bound handler already does.
                onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
              }}
            >
              {confirmActionLabel ?? "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
);
DeleteButton.displayName = "DeleteButton";

/** Copy to clipboard. Ghost. */
export const CopyButton = makeAction(
  { variant: "ghost", size: "icon-sm", icon: Copy, defaultLabel: "Copy" },
  "CopyButton",
);

/** Reload / refresh data. Ghost. */
export const RefreshButton = makeAction(
  { variant: "ghost", size: "icon", icon: RefreshCw, defaultLabel: "Refresh" },
  "RefreshButton",
);

/** Carousel / paginator previous. */
export const NavPrevButton = makeAction(
  { variant: "sage-outline", size: "icon", icon: ChevronLeft, defaultLabel: "Previous" },
  "NavPrevButton",
);

/** Carousel / paginator next. */
export const NavNextButton = makeAction(
  { variant: "sage-outline", size: "icon", icon: ChevronRight, defaultLabel: "Next" },
  "NavNextButton",
);

/** Quantity stepper minus. */
export const QtyMinusButton = makeAction(
  { variant: "sage-outline", size: "icon-sm", icon: Minus, defaultLabel: "Decrease" },
  "QtyMinusButton",
);

/** Quantity stepper plus. */
export const QtyPlusButton = makeAction(
  { variant: "sage-outline", size: "icon-sm", icon: Plus, defaultLabel: "Increase" },
  "QtyPlusButton",
);
