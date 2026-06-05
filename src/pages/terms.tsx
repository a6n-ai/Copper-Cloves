import Link from "next/link";
import { SEO as Seo } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

const LAST_UPDATED = "12 May 2026";

export default function TermsPage() {
  return (
    <>
      <Seo
        title="Terms & Conditions | The Studio by Copper + Cloves"
        description="Terms and conditions for using our website, booking classes, café, boutique, and member services at The Studio by Copper + Cloves, Bengaluru."
      />


      <div className="min-h-screen bg-linear-to-b from-cream via-[#fafaf8] to-cream">
        <section className="relative pt-28 pb-12 px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <Button asChild variant="sage-outline" className="mb-8">
              <Link href="/">
                <ArrowLeft className="mr-2" size={20} />
                Back to Home
              </Link>
            </Button>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/10 border border-sage/20 mb-6">
              <FileText className="text-sage" size={16} />
              <span className="font-body text-xs text-charcoal font-medium tracking-wide uppercase">
                Legal
              </span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-4">
              Terms &amp; Conditions
            </h1>
            <p className="font-body text-charcoal/65 text-sm mb-12">
              Last updated: {LAST_UPDATED}
            </p>

            <div className="max-w-none font-body text-charcoal/85 space-y-10 leading-relaxed">
              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal pt-2">1. Agreement</h2>
                <p>
                  These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the website
                  and services of <strong>The Studio by Copper + Cloves</strong> (&quot;the Studio&quot;,
                  &quot;we&quot;, &quot;us&quot;). By using our website, creating an account, booking a class,
                  placing an order, or visiting our premises, you agree to these Terms. If you do not agree,
                  please do not use our services.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">2. Who we are</h2>
                <p>
                  The Studio by Copper + Cloves operates a movement and wellness space in Bengaluru, India,
                  including group fitness and specialty classes, a plant-forward café experience, retail
                  (boutique) offerings, and member tools accessed through our online portal.
                </p>
                <p className="text-sm text-charcoal/70">
                  <strong>Studio address:</strong> 1226, 12th Main Road, HAL 2nd Stage, Indiranagar,
                  Bengaluru, Karnataka 560038, India.
                  <br />
                  <strong>Email:</strong>{" "}
                  <a href="mailto:thestudio@copperandcloves.com" className="text-sage hover:underline">
                    thestudio@copperandcloves.com
                  </a>
                  <br />
                  <strong>Phone:</strong>{" "}
                  <a href="tel:+919008426703" className="text-sage hover:underline">
                    +91 90084 26703
                  </a>
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">3. Services we offer (summary)</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Classes &amp; schedules:</strong> Bookings, waitlists, and in-studio participation
                    subject to capacity, instructor availability, and our schedule.
                  </li>
                  <li>
                    <strong>Passes &amp; packages:</strong> Class passes, studio memberships, and related
                    entitlements as described at purchase; validity and credit rules apply as stated on our
                    site or at the Studio.
                  </li>
                  <li>
                    <strong>Café &amp; meal programmes:</strong> Food and beverage orders, including ordering
                    linked to visits where offered; meal subscription or waitlist enquiries are subject to
                    availability and separate communication from us.
                  </li>
                  <li>
                    <strong>Boutique / shop:</strong> Retail products sold subject to stock, pricing, and
                    delivery or collection arrangements shown at checkout or confirmed by us.
                  </li>
                  <li>
                    <strong>Member portal:</strong> Account features for registered users (e.g. bookings,
                    profile, history) as we make them available.
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">4. Accounts &amp; eligibility</h2>
                <p>
                  You must provide accurate information when you register or book. You are responsible for
                  keeping login details confidential and for activity under your account. We may suspend or
                  close accounts that misuse the service, abuse staff or members, or breach these Terms.
                  You must be legally able to enter a contract in India (or have a parent/guardian arrange
                  services where applicable).
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">5. Bookings, cancellations &amp; no-shows</h2>
                <p>
                  Class space is limited. Cancellation, late cancellation, no-show, and refund policies may
                  apply as communicated at booking, in-app, on signage, or by our team. We may update
                  operational rules to keep classes fair and safe for all members. Repeated no-shows may
                  affect your ability to book.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">6. Health, safety &amp; assumption of risk</h2>
                <p>
                  Movement, martial arts, aerial, and related activities involve physical exertion and
                  inherent risk. You confirm that you are in appropriate health to participate or will seek
                  medical advice first. You agree to follow instructor and Studio safety instructions and
                  to complete any waiver or consent we require before participation. If you feel unwell,
                  stop and inform staff.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">7. Payments, prices &amp; promotions</h2>
                <p>
                  Prices, fees, taxes (if applicable), and payment methods are as shown at checkout or
                  collected at the Studio unless we agree otherwise. We may run promotions, packages, or
                  coupon codes subject to their stated rules. Third-party payment processors handle card or
                  UPI flows where used; their terms also apply.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">8. Café, retail &amp; orders</h2>
                <p>
                  Menu items and products may change with seasonality and supply. Allergen and dietary
                  information is provided in good faith but the Studio cannot guarantee an allergen-free
                  environment in a shared kitchen. For retail, risk of loss and title pass as per our
                  delivery or collection process stated at purchase.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">9. Intellectual property</h2>
                <p>
                  Branding, logos, text, images, videos, class formats, and site content are owned by the
                  Studio or our licensors. You may not copy, scrape, or reuse them for commercial purposes
                  without written permission.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">10. Acceptable use</h2>
                <p>
                  Do not misuse the website (e.g. hacking, bots that harm performance, harassment, or
                  posting unlawful content). We may remove content or block access for violations.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">11. Third-party links</h2>
                <p>
                  Our site may link to maps, social media, or partners. We are not responsible for their
                  content or policies.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">12. Limitation of liability</h2>
                <p>
                  To the fullest extent permitted by applicable law in India, the Studio and our team are
                  not liable for indirect, incidental, special, consequential, or punitive damages, or loss
                  of profits, arising from your use of our services or premises. Our total liability for
                  claims relating to a given service is limited, where the law allows, to the amount you
                  paid us for that specific transaction in the three (3) months before the event, unless
                  a mandatory statute provides otherwise.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">13. Indemnity</h2>
                <p>
                  You agree to indemnify and hold harmless the Studio and its staff from claims arising from
                  your breach of these Terms, misuse of the services, or injury where caused by your disregard
                  of safety rules or misrepresentation of health status, except where prohibited by law.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">14. Changes</h2>
                <p>
                  We may update these Terms from time to time. The &quot;Last updated&quot; date will change
                  when we do. Continued use after changes constitutes acceptance where the law allows. For
                  material changes, we will try to give reasonable notice on the website or by email where
                  appropriate.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">15. Governing law &amp; disputes</h2>
                <p>
                  These Terms are governed by the laws of India. Courts at Bengaluru, Karnataka shall have
                  exclusive jurisdiction, subject to any consumer rights you cannot waive under applicable
                  law.
                </p>
              </section>

              <section className="space-y-3 border-t border-sage/15 pt-8">
                <h2 className="font-display text-2xl text-charcoal">16. Contact</h2>
                <p>
                  Questions about these Terms:{" "}
                  <a href="mailto:thestudio@copperandcloves.com" className="text-sage hover:underline">
                    thestudio@copperandcloves.com
                  </a>
                </p>
                <p className="text-sm text-charcoal/55 italic">
                  This page is provided for general information and does not replace legal advice. For
                  business-specific contracts or disputes, consult a qualified lawyer.
                </p>
              </section>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
