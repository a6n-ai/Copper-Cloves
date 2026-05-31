import Link from "next/link";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const LAST_UPDATED = "12 May 2026";

export default function PrivacyPolicyPage() {
  return (
    <>
      <SEO
        title="Privacy Policy | The Studio by Copper + Cloves"
        description="Privacy Policy for The Studio by Copper + Cloves, explaining how we collect, use, protect, and manage personal information for website visitors, members, bookings, café, boutique, and studio services."
      />

      <Navigation />

      <div className="min-h-screen bg-linear-to-b from-cream via-[#fafaf8] to-cream">
        <section className="relative pt-28 pb-12 px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <Link href="/">
              <Button
                variant="outline"
                className="mb-8 border-sage/30 hover:bg-sage/5 text-charcoal"
              >
                <ArrowLeft className="mr-2" size={20} />
                Back to Home
              </Button>
            </Link>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/10 border border-sage/20 mb-6">
              <ShieldCheck className="text-sage" size={16} />
              <span className="font-body text-xs text-charcoal font-medium tracking-wide uppercase">
                Legal
              </span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-4">
              Privacy Policy
            </h1>
            <p className="font-body text-charcoal/65 text-sm mb-12">
              Last updated: {LAST_UPDATED}
            </p>

            <div className="max-w-none font-body text-charcoal/85 space-y-10 leading-relaxed">
              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal pt-2">1. Introduction</h2>
                <p>
                  This Privacy Policy explains how <strong>The Studio by Copper + Cloves</strong>{" "}
                  (&quot;the Studio&quot;, &quot;we&quot;, &quot;us&quot;) collects, uses, stores,
                  shares, and protects personal information when you use our website, create an account,
                  book a class, visit our premises, place an order, contact us, or use our café, boutique,
                  wellness, fitness, and member services.
                </p>
                <p>
                  By using our website or services, you agree to the collection and use of your information
                  as described in this Privacy Policy.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">2. Who we are</h2>
                <p>
                  The Studio by Copper + Cloves operates a movement and wellness space in Bengaluru, India,
                  including group fitness and specialty classes, a plant-forward café experience, retail
                  offerings, and member tools accessed through our online portal.
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
                <h2 className="font-display text-2xl text-charcoal">3. Information we collect</h2>
                <p>
                  We may collect information that you provide directly to us, information generated through
                  your use of our services, and limited technical information from your device or browser.
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Identity and contact details:</strong> name, phone number, email address,
                    age, gender, emergency contact, and communication preferences.
                  </li>
                  <li>
                    <strong>Account information:</strong> login details, profile information, class history,
                    booking activity, membership status, and preferences.
                  </li>
                  <li>
                    <strong>Booking and transaction details:</strong> class bookings, packages, credits,
                    cancellations, no-shows, payment status, invoices, order history, and related records.
                  </li>
                  <li>
                    <strong>Health and safety information:</strong> injuries, medical conditions, fitness
                    limitations, pregnancy-related information, or other information you voluntarily share
                    so we can support a safer studio experience.
                  </li>
                  <li>
                    <strong>Café, boutique, and order information:</strong> food and beverage orders,
                    retail purchases, delivery or collection details, and dietary preferences where shared.
                  </li>
                  <li>
                    <strong>Website and technical information:</strong> IP address, browser type, device
                    information, pages visited, approximate location, time spent on pages, and referral source.
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">4. How we use your information</h2>
                <p>We use your personal information for purposes connected with operating the Studio and providing our services, including to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Create, manage, and maintain your account.</li>
                  <li>Process bookings, class credits, cancellations, memberships, packages, and payments.</li>
                  <li>Send booking confirmations, class reminders, schedule updates, and service messages.</li>
                  <li>Respond to enquiries, feedback, complaints, and support requests.</li>
                  <li>Provide a safer class, movement, aerial, martial arts, wellness, café, and retail experience.</li>
                  <li>Improve our website, member portal, studio operations, services, and customer experience.</li>
                  <li>Share updates about classes, workshops, programmes, events, offers, and studio announcements.</li>
                  <li>Prevent fraud, misuse, unauthorized access, security incidents, and violations of our Terms.</li>
                  <li>Comply with legal, accounting, tax, regulatory, and business record requirements.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">5. Consent</h2>
                <p>
                  Where required by applicable law, we collect and process your personal information with
                  your consent. By submitting your details, creating an account, booking a class, placing an
                  order, contacting us, or participating in Studio services, you consent to the use of your
                  information for the purposes described in this Privacy Policy.
                </p>
                <p>
                  You may withdraw your consent by contacting us. However, withdrawal of consent may affect
                  our ability to provide certain services, including account access, bookings, payment support,
                  class reminders, membership management, or safety-related support.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">6. Health and safety information</h2>
                <p>
                  Some of our services involve physical movement, fitness, martial arts, aerial, yoga,
                  wellness, or related activities. We may ask you to share relevant health or safety
                  information before participation.
                </p>
                <p>
                  This information is used only to help us understand your needs, support safer participation,
                  and determine whether additional precautions may be required. It is not a substitute for
                  medical advice. You should consult a qualified medical professional before participating
                  if you have any medical condition, injury, pregnancy-related concern, or health limitation.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">7. Payments and third-party processors</h2>
                <p>
                  Payments may be processed through third-party payment gateways, banking partners, or
                  technology providers. We may receive limited transaction details such as payment status,
                  amount paid, transaction reference, invoice details, and purchase history.
                </p>
                <p>
                  We do not store your full card number, UPI PIN, banking password, OTP, or payment
                  authentication credentials on our own systems. Payment providers process such information
                  according to their own terms and privacy policies.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">8. Sharing of information</h2>
                <p>
                  We do not sell your personal information. We may share information only where necessary
                  for operating our services, fulfilling legal requirements, or protecting our rights and users.
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Payment gateways and financial service providers.</li>
                  <li>Booking, scheduling, membership, and customer management platforms.</li>
                  <li>Website hosting, analytics, email, SMS, WhatsApp, and technology service providers.</li>
                  <li>Delivery, logistics, or fulfilment partners where relevant for café or boutique orders.</li>
                  <li>Professional advisors such as legal, accounting, tax, or compliance consultants.</li>
                  <li>Government, regulatory, law enforcement, or judicial authorities where required by law.</li>
                </ul>
                <p>
                  Where we use third-party service providers, we expect them to process information only for
                  the intended purpose and to use reasonable security measures.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">9. Cookies and analytics</h2>
                <p>
                  Our website may use cookies, pixels, analytics tools, or similar technologies to improve
                  performance, understand visitor behaviour, remember preferences, and enhance your experience.
                </p>
                <p>
                  You can disable cookies through your browser settings. Some parts of the website may not
                  function properly if cookies are disabled.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">10. Marketing communications</h2>
                <p>
                  We may use your contact details to send updates about classes, workshops, events, packages,
                  promotions, café offerings, boutique launches, or Studio announcements.
                </p>
                <p>
                  You may opt out of promotional communications by contacting us or using the unsubscribe
                  option where available. We may still send important service-related messages, including
                  booking confirmations, payment updates, cancellation notices, safety updates, or policy changes.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">11. Data retention</h2>
                <p>
                  We retain personal information only for as long as necessary to provide our services,
                  manage accounts, maintain booking and transaction records, comply with legal obligations,
                  resolve disputes, enforce our Terms, and support legitimate business requirements.
                </p>
                <p>
                  When information is no longer required, we may delete, anonymize, or securely archive it.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">12. Data security</h2>
                <p>
                  We take reasonable technical and organizational measures to protect personal information
                  from unauthorized access, misuse, alteration, disclosure, loss, or destruction.
                </p>
                <p>
                  However, no website, payment system, internet transmission, or digital storage method is
                  completely secure. You use our website and services with this understanding.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">13. Your rights</h2>
                <p>
                  Subject to applicable law, you may have the right to access, correct, update, or request
                  deletion of your personal information. You may also withdraw consent for certain processing
                  activities or raise a concern about how your information is handled.
                </p>
                <p>
                  To make a request, please contact us using the details provided in this Privacy Policy.
                  We may need to verify your identity before processing your request.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">14. Children and minors</h2>
                <p>
                  Our services are generally intended for adults. Where classes, workshops, events, or
                  programmes are made available to minors, participation must be arranged or consented to by
                  a parent or legal guardian, where required.
                </p>
                <p>
                  We do not knowingly collect personal information from minors without appropriate consent.
                  If you believe a minor has provided us information without proper consent, please contact us.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">15. Third-party links</h2>
                <p>
                  Our website may contain links to third-party websites, maps, social media platforms,
                  payment gateways, partner tools, or other external services. We are not responsible for
                  the content, privacy practices, or security of third-party websites or platforms.
                </p>
                <p>
                  You should review their privacy policies before sharing personal information with them.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-2xl text-charcoal">16. Changes to this Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date will
                  change when we make updates. Continued use of our website or services after changes are
                  posted means you accept the updated Privacy Policy, where permitted by law.
                </p>
                <p>
                  For material changes, we will try to provide reasonable notice on the website or by email
                  where appropriate.
                </p>
              </section>

              <section className="space-y-3 border-t border-sage/15 pt-8">
                <h2 className="font-display text-2xl text-charcoal">17. Contact</h2>
                <p>
                  For privacy questions, consent withdrawal, data access, correction, deletion, or grievance
                  requests, please contact us at:{" "}
                  <a href="mailto:thestudio@copperandcloves.com" className="text-sage hover:underline">
                    thestudio@copperandcloves.com
                  </a>
                </p>
                <p className="text-sm text-charcoal/55 italic">
                  This page is provided for general information and does not replace legal advice. For
                  business-specific privacy obligations, consult a qualified lawyer.
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
