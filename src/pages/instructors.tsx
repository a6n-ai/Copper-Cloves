import { useState } from "react";
import type { GetStaticProps } from "next";
import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { InstructorCard } from "@/components/instructors/InstructorCard";
import { InstructorDetailDialog } from "@/components/instructors/InstructorDetailDialog";
import prisma from "@/lib/prisma";
import { dedupeInstructorRows } from "@/lib/instructorIdentity";
import { toInstructorView, type InstructorView } from "@/lib/instructorView";

interface InstructorsPageProps {
  instructors: InstructorView[];
}

const GRID_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px";

export const getStaticProps: GetStaticProps<InstructorsPageProps> = async () => {
  try {
    const rows = await prisma.instructor.findMany({
      where: { is_active: true },
      orderBy: { display_order: "asc" },
      omit: { studio_payout_cut_percent: true },
    });
    const instructors = dedupeInstructorRows(rows).map(toInstructorView);
    // Strip `undefined` (unset socials) — getStaticProps cannot serialize it.
    return { props: { instructors: JSON.parse(JSON.stringify(instructors)) }, revalidate: 300 };
  } catch {
    return { props: { instructors: [] }, revalidate: 300 };
  }
};

export default function InstructorsPage({ instructors }: InstructorsPageProps) {
  const [selected, setSelected] = useState<InstructorView | null>(null);

  return (
    <>
      <SEO
        title="Our Instructors | The Studio by Copper + Cloves"
        description="Meet the instructors at The Studio by Copper + Cloves. Trained experts who bring craft, warmth, and heart to every class in our Bangalore wellness studio."
      />


      {/* Hero */}
      <section className="bg-cream pt-32 pb-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-sage">
            The Studio · Instructors
          </p>
          <h1 className="mt-3 max-w-[16ch] font-display text-5xl leading-[1.05] text-charcoal md:text-6xl">
            The people who hold the <em className="italic text-sage">room</em>.
          </h1>
          <p className="mt-5 max-w-[62ch] font-body text-lg leading-relaxed text-charcoal/70">
            Every class here is led by a real person with a real practice. Coaches, healers,
            and movement specialists who have spent years learning how to meet you where you
            are, then take you a little further.
          </p>
        </div>
      </section>

      {/* Roster */}
      <section className="bg-cream pb-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {instructors.length === 0 ? (
            <div className="rounded-2xl border border-[#e5e4dc] bg-white-warm py-20 text-center">
              <p className="font-body text-charcoal/60">
                Our instructor roster is being updated. Check back soon.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8 flex items-baseline justify-between border-b border-[#e5e4dc] pb-4">
                <h2 className="font-display text-2xl text-charcoal md:text-3xl">Meet the team</h2>
                <span className="font-body text-sm text-charcoal/50">
                  {instructors.length} {instructors.length === 1 ? "instructor" : "instructors"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {instructors.map((instructor, i) => (
                  <InstructorCard
                    key={instructor.id ?? `${instructor.name}-${i}`}
                    instructor={instructor}
                    onOpen={setSelected}
                    sizes={GRID_SIZES}
                    priority={i < 3}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <Footer
        cta={{
          heading: "Find them on the schedule.",
          body: "Every instructor leads classes through the week. Browse the timetable and book the one that fits your practice.",
          primary: { label: "View weekly schedule", href: "/classes?tab=schedule" },
          secondary: { label: "Explore classes", href: "/classes" },
        }}
      />

      {selected && (
        <InstructorDetailDialog instructor={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
