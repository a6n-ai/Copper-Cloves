import { createContext, useContext, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type RootProps = { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode };

// One matchMedia listener per ResponsiveDialog instance (was 4-6, one per part).
// Value is also frozen for the open session so a resize across 768px can't
// unmount+remount the entire subtree and clobber form state mid-edit.
const RespCtx = createContext<boolean | null>(null);

function useRespMobile(): boolean {
  return useContext(RespCtx) ?? false;
}

export function ResponsiveDialog({ open, onOpenChange, children }: RootProps) {
  const liveIsMobile = useIsMobile();
  const [frozen, setFrozen] = useState<boolean | null>(null);

  useEffect(() => {
    if (open === false) {
      if (frozen !== null) setFrozen(null);
      return;
    }
    if (frozen === null) setFrozen(liveIsMobile);
  }, [open, liveIsMobile, frozen]);

  const isMobile = frozen ?? liveIsMobile;
  const Root = isMobile ? Sheet : Dialog;
  return (
    <RespCtx.Provider value={isMobile}>
      <Root open={open} onOpenChange={onOpenChange}>{children}</Root>
    </RespCtx.Provider>
  );
}

export function ResponsiveDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  const isMobile = useRespMobile();
  const T = isMobile ? SheetTrigger : DialogTrigger;
  return <T {...props} />;
}

export function ResponsiveDialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useRespMobile();
  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        className={cn("max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]", className)}
        {...(props as React.ComponentProps<typeof SheetContent>)}
      >
        {children}
      </SheetContent>
    );
  }
  return (
    <DialogContent
      className={cn("max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto sm:w-full", className)}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader(props: React.ComponentProps<typeof DialogHeader>) {
  const isMobile = useRespMobile();
  const H = isMobile ? SheetHeader : DialogHeader;
  return <H {...props} />;
}

export function ResponsiveDialogFooter(props: React.ComponentProps<typeof DialogFooter>) {
  const isMobile = useRespMobile();
  const F = isMobile ? SheetFooter : DialogFooter;
  return <F {...props} />;
}

export function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useRespMobile();
  const T = isMobile ? SheetTitle : DialogTitle;
  return <T {...props} />;
}

export function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useRespMobile();
  const D = isMobile ? SheetDescription : DialogDescription;
  return <D {...props} />;
}
