import { useEffect, useRef } from "react";
import { Award, Heart, Sparkles, MessageCircle } from "lucide-react";
// lucide v1 removed every brand icon for trademark reasons; SocialIcons holds
// the simple-icons (CC0) replacements with the same `size`/className API.
import { FacebookIcon, TwitterIcon, LinkedinIcon } from "@/components/icons/SocialIcons";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { CloseButton } from "@/components/ui/quick-actions";
import { InstructorPhoto } from "@/components/instructors/InstructorPhoto";
import { InstructorMonogram } from "@/components/instructors/InstructorMonogram";
import { instructorHasSocials, type InstructorView } from "@/lib/instructorView";

/**
 * Full instructor profile, shown as a centered overlay. Editorial two-column
 * layout: a tall portrait on the left (monogram fallback when there's no photo),
 * scrollable detail on the right. Shared by the homepage carousel and the
 * `/instructors` page. Owns its own scroll lock, Escape handling, and initial
 * focus so callers only manage open/close state.
 */
export function InstructorDetailDialog({
  instructor,
  onClose,
}: {
  instructor: InstructorView;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${instructor.name}, ${instructor.title}`}
    >
      <div
        className="relative grid max-h-[88vh] w-full max-w-4xl grid-rows-[auto_1fr] overflow-hidden rounded-3xl bg-white-warm shadow-[0_8px_48px_rgba(51,51,51,0.14)] animate-in zoom-in-95 duration-300 md:grid-cols-[0.85fr_1.15fr] md:grid-rows-1"
        onClick={(e) => e.stopPropagation()}
      >
        <CloseButton
          ref={closeRef}
          onClick={onClose}
          label="Close profile"
          className="absolute right-4 top-4 z-20 rounded-full border border-sage/20 bg-white-warm shadow-sm"
        />

        {/* Portrait */}
        <div className="relative h-56 overflow-hidden bg-sand md:h-auto">
          {instructor.hasImage ? (
            <InstructorPhoto
              src={instructor.image}
              name={instructor.name}
              sizes="(max-width: 768px) 100vw, 360px"
              priority
            />
          ) : (
            <InstructorMonogram name={instructor.name} textClassName="text-7xl" />
          )}
          {/* Name plate over the portrait for an editorial, magazine feel. */}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-charcoal/70 via-charcoal/25 to-transparent p-5 pt-12">
            <h2 className="font-display text-3xl leading-tight text-cream md:text-4xl">
              {instructor.name}
            </h2>
            <p className="mt-1 font-body text-xs font-semibold uppercase tracking-[0.12em] text-cream/85">
              {instructor.title}
            </p>
          </div>
        </div>

        {/* Detail */}
        <div className="overflow-y-auto p-6 md:p-8">
          {instructor.experience && (
            <Pill tone="warning" size="md" icon={<Sparkles size={13} />} className="mb-5">
              {instructor.experience}
            </Pill>
          )}

          {instructorHasSocials(instructor) && (
            <div className="mb-6 flex items-center gap-2">
              <span className="mr-1 font-body text-xs text-charcoal/60">Connect:</span>
              {instructor.social_facebook && (
                <SocialLink href={instructor.social_facebook} label="Facebook profile">
                  <FacebookIcon className="text-charcoal/70" size={16} />
                </SocialLink>
              )}
              {instructor.social_twitter && (
                <SocialLink href={instructor.social_twitter} label="Twitter profile">
                  <TwitterIcon className="text-charcoal/70" size={16} />
                </SocialLink>
              )}
              {instructor.social_linkedin && (
                <SocialLink href={instructor.social_linkedin} label="LinkedIn profile">
                  <LinkedinIcon className="text-charcoal/70" size={16} />
                </SocialLink>
              )}
              {instructor.social_whatsapp && (
                <SocialLink
                  href={`https://wa.me/${instructor.social_whatsapp.replace(/[^0-9]/g, "")}`}
                  label="WhatsApp"
                >
                  <MessageCircle className="text-charcoal/70" size={16} />
                </SocialLink>
              )}
            </div>
          )}

          {instructor.philosophy && (
            <figure className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <Heart className="text-sage" size={16} />
                <figcaption className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-sage">
                  Philosophy
                </figcaption>
              </div>
              <blockquote className="font-display text-xl leading-snug text-charcoal/85">
                &ldquo;{instructor.philosophy}&rdquo;
              </blockquote>
            </figure>
          )}

          {instructor.about && (
            <div className="mb-6">
              <h3 className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.1em] text-charcoal/45">
                About
              </h3>
              <p className="font-body text-sm leading-relaxed text-charcoal/80">{instructor.about}</p>
            </div>
          )}

          {instructor.specialties.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.1em] text-charcoal/45">
                Specialties
              </h3>
              <div className="flex flex-wrap gap-2">
                {instructor.specialties.map((s) => (
                  <Pill key={s} tone="success" size="md">
                    {s}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {instructor.certifications.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Award className="text-terracotta" size={16} />
                <h3 className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-charcoal/45">
                  Certifications
                </h3>
              </div>
              <ul className="space-y-2">
                {instructor.certifications.map((cert) => (
                  <li key={cert} className="flex items-start gap-2">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/60" />
                    <span className="font-body text-sm text-charcoal/80">{cert}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button type="button" variant="sage" onClick={onClose} className="w-full rounded-md sm:w-auto">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-sage/10 transition-colors duration-200 hover:bg-sage/20"
    >
      {children}
    </a>
  );
}
