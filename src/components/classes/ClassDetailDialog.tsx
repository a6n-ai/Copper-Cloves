import Image from "next/image";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { CheckCircle, Clock, Users } from "lucide-react";
import { InstructorStrip } from "./InstructorStrip";
import { classInitials, classFallbackGradient } from "./classFallback";
import type { PublicClass } from "@/pages/classes";

export function ClassDetailDialog({
  classItem,
  authed,
  onClose,
  onBook,
}: {
  classItem: PublicClass | null;
  authed: boolean;
  onClose: () => void;
  onBook: () => void;
}) {
  return (
    <ResponsiveDialog open={!!classItem} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-lg overflow-hidden bg-white-warm p-0 sm:max-h-[90vh] sm:overflow-y-auto [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-white-warm/90 [&>button]:text-charcoal [&>button]:opacity-100 [&>button]:shadow-md hover:[&>button]:bg-white-warm">
        {classItem && (
          <>
            <div className="relative h-44">
              {classItem.imageUrl ? (
                <Image src={classItem.imageUrl} alt={classItem.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              ) : (
                <div className={`h-full w-full ${classFallbackGradient}`} aria-hidden="true">
                  <span className="font-display text-5xl text-white-warm/55">{classInitials(classItem.name)}</span>
                </div>
              )}
              <Pill tone="success" size="sm" className="absolute left-4 top-4 bg-white-warm/90">
                {classItem.category}
              </Pill>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <ResponsiveDialogHeader className="space-y-1 text-left">
                <ResponsiveDialogTitle className="font-display text-3xl text-charcoal">
                  {classItem.name}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-sm text-charcoal/55">
                  <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{classItem.duration} min</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="size-4" />up to {classItem.maxCapacity} spots</span>
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>

              {classItem.description && (
                <p className="font-body text-sm leading-relaxed text-charcoal/75">{classItem.description}</p>
              )}

              {classItem.benefits.length > 0 && (
                <div>
                  <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-sage">
                    What you&apos;ll gain
                  </p>
                  <ul className="space-y-1.5">
                    {classItem.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 font-body text-sm text-charcoal/75">
                        <CheckCircle className="mt-0.5 size-4 shrink-0 text-sage" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {classItem.instructor && <InstructorStrip instructor={classItem.instructor} />}

              <Button variant="sage" className="w-full" onClick={onBook}>
                {authed ? "Book this class" : "Sign up to book"}
              </Button>
            </div>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
