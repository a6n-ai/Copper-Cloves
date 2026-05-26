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

export function ResponsiveDialog({ open, onOpenChange, children }: RootProps) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Sheet : Dialog;
  return <Root open={open} onOpenChange={onOpenChange}>{children}</Root>;
}

export function ResponsiveDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  const isMobile = useIsMobile();
  const T = isMobile ? SheetTrigger : DialogTrigger;
  return <T {...props} />;
}

export function ResponsiveDialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        className={cn("max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]", className)}
        {...(props as any)}
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
  const isMobile = useIsMobile();
  const H = isMobile ? SheetHeader : DialogHeader;
  return <H {...props} />;
}

export function ResponsiveDialogFooter(props: React.ComponentProps<typeof DialogFooter>) {
  const isMobile = useIsMobile();
  const F = isMobile ? SheetFooter : DialogFooter;
  return <F {...props} />;
}

export function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsMobile();
  const T = isMobile ? SheetTitle : DialogTitle;
  return <T {...props} />;
}

export function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsMobile();
  const D = isMobile ? SheetDescription : DialogDescription;
  return <D {...props} />;
}
