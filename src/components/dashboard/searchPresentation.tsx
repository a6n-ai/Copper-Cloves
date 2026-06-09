// src/components/dashboard/searchPresentation.tsx
import { Users, Calendar, CreditCard, Package, Coffee, Building2, GraduationCap, ClipboardList, FileText, type LucideIcon } from "lucide-react";
import type { PillProps } from "@/components/ui/pill";

type Tone = NonNullable<PillProps["tone"]>;

const MAP: Record<string, { icon: LucideIcon; tone: Tone; pillLabel: string }> = {
  member:     { icon: Users,          tone: "success", pillLabel: "Member" },
  schedule:   { icon: Calendar,       tone: "info",    pillLabel: "Schedule" },
  payment:    { icon: CreditCard,     tone: "warning", pillLabel: "Payment" },
  product:    { icon: Package,        tone: "neutral", pillLabel: "Product" },
  cafe:       { icon: Coffee,         tone: "warning", pillLabel: "Café" },
  partner:    { icon: Building2,      tone: "info",    pillLabel: "Partner" },
  instructor: { icon: GraduationCap,  tone: "success", pillLabel: "Instructor" },
  booking:    { icon: ClipboardList,  tone: "neutral", pillLabel: "Booking" },
  package:    { icon: Package,        tone: "success", pillLabel: "Package" },
  page:       { icon: FileText,       tone: "neutral", pillLabel: "Page" },
};

export function presentation(type: string) {
  return MAP[type] ?? { icon: FileText, tone: "neutral" as Tone, pillLabel: type };
}
