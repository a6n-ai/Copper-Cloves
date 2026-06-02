import { cdnUrl } from "@/lib/cdnUrl";

/**
 * Display shape for a public instructor, shared by the homepage teaser carousel
 * (`components/Instructors.tsx`, client SWR) and the dedicated `/instructors`
 * page (`pages/instructors.tsx`, getStaticProps). One mapper, one source of
 * truth, so the card + detail dialog render identically in both places.
 */
export interface InstructorView {
  id?: string;
  name: string;
  title: string;
  /** Pre-formatted, e.g. "8 years experience"; empty when unknown. */
  experience: string;
  about: string;
  image: string;
  /** Whether a real photo exists; false means callers should render a monogram. */
  hasImage: boolean;
  specialties: string[];
  certifications: string[];
  philosophy: string;
  social_facebook?: string;
  social_twitter?: string;
  social_linkedin?: string;
  social_whatsapp?: string;
}

/** Raw instructor row as returned by Prisma / `/api/admin/instructors`. */
export interface InstructorRowLike {
  id: string;
  name: string;
  title?: string | null;
  years_of_experience?: string | number | null;
  about?: string | null;
  image_url?: string | null;
  specialties?: string[] | null;
  certifications?: string[] | null;
  philosophy?: string | null;
  social_facebook?: string | null;
  social_twitter?: string | null;
  social_linkedin?: string | null;
  social_whatsapp?: string | null;
}

const PLACEHOLDER = cdnUrl("/placeholder.jpg");

export function toInstructorView(row: InstructorRowLike): InstructorView {
  return {
    id: row.id,
    name: row.name,
    title: row.title || "Instructor",
    experience: row.years_of_experience ? `${row.years_of_experience} years experience` : "",
    about: row.about || "",
    image: row.image_url || PLACEHOLDER,
    hasImage: Boolean(row.image_url),
    specialties: row.specialties ?? [],
    certifications: row.certifications ?? [],
    philosophy: row.philosophy || "",
    social_facebook: row.social_facebook ?? undefined,
    social_twitter: row.social_twitter ?? undefined,
    social_linkedin: row.social_linkedin ?? undefined,
    social_whatsapp: row.social_whatsapp ?? undefined,
  };
}

/** One- or two-letter monogram from a name, for photo-less avatars. */
export function instructorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function instructorHasSocials(i: InstructorView): boolean {
  return Boolean(i.social_facebook || i.social_twitter || i.social_linkedin || i.social_whatsapp);
}

/**
 * A couple of roster photos are framed toward one side; nudge the crop so faces
 * stay in frame. Mirrors the original per-name rule from `Instructors.tsx`.
 */
export function instructorObjectPositionClass(name: string): string {
  return name === "Shruti" || name === "Siddhartha" ? "object-top-right" : "object-top";
}