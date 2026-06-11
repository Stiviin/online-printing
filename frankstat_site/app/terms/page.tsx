import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Frankstat Printing Solutions",
  description: "Read the Terms of Service for Frankstat Printing Solutions. Understand your rights, obligations, and our service conditions before placing an order.",
};

const LAST_UPDATED = "2026";

export default function TermsPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', system-ui, sans-serif; background: #060D1A; color: #E2EAF4; line-height: 1.7; }

        .page-wrap { max-width: 780px; margin: 0 auto; padding: 0 1.5rem 5rem; }

        /* Header */
        .page-header {
          padding: 3rem 0 2.5rem;
          border-bottom: 1px solid rgba(0,174,239,0.15);
          margin-bottom: 3rem;
        }
        .back-link {
          display: inline-flex; align-items: center; gap: 0.4rem;
          color: #8CA0B8; text-decoration: none; font-size: 0.85rem;
          font-weight: 500; margin-bottom: 1.75rem;
          transition: color 0.2s;
        }
        .back-link:hover { color: #00AEEF; }

        .eyebrow {
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase;
          background: linear-gradient(90deg, #00AEEF, #EC008C);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; margin-bottom: 0.75rem;
        }
        .page-title {
          font-size: clamp(2rem, 5vw, 2.8rem); font-weight: 800;
          color: #fff; letter-spacing: -0.03em; line-height: 1.1;
          margin-bottom: 0.75rem;
        }
        .page-meta { font-size: 0.85rem; color: #8CA0B8; }
        .page-meta strong { color: #00AEEF; }

        /* TOC */
        .toc {
          background: #0A1525; border: 1px solid rgba(0,174,239,0.15);
          border-radius: 14px; padding: 1.5rem 1.75rem; margin-bottom: 3rem;
        }
        .toc-title {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em;
          text-transform: uppercase; color: #00AEEF; margin-bottom: 1rem;
        }
        .toc-list { list-style: none; display: flex; flex-direction: column; gap: 0.45rem; }
        .toc-list li a {
          color: #8CA0B8; text-decoration: none; font-size: 0.87rem;
          font-weight: 500; transition: color 0.2s;
          display: flex; align-items: center; gap: 0.5rem;
        }
        .toc-list li a:hover { color: #00AEEF; }
        .toc-num { color: #1E3A5F; font-size: 0.75rem; font-weight: 700; min-width: 22px; }

        /* Sections */
        .section { margin-bottom: 3rem; scroll-margin-top: 2rem; }
        .section-num {
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.15em;
          text-transform: uppercase; color: #EC008C; margin-bottom: 0.4rem;
        }
        .section-title {
          font-size: 1.25rem; font-weight: 700; color: #fff;
          letter-spacing: -0.02em; margin-bottom: 1rem;
          padding-bottom: 0.6rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .section p { font-size: 0.93rem; color: #B0C0D4; margin-bottom: 0.85rem; }
        .section p:last-child { margin-bottom: 0; }

        .list { list-style: none; padding: 0; margin: 0.75rem 0 0.85rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .list li {
          display: flex; gap: 0.75rem; align-items: flex-start;
          font-size: 0.91rem; color: #B0C0D4;
        }
        .list li::before {
          content: "→"; color: #00AEEF; font-weight: 700;
          flex-shrink: 0; margin-top: 0.02em;
        }

        .highlight-box {
          background: rgba(0,174,239,0.07);
          border: 1px solid rgba(0,174,239,0.2);
          border-left: 3px solid #00AEEF;
          border-radius: 8px; padding: 1rem 1.25rem;
          margin: 1rem 0;
          font-size: 0.88rem; color: #B0C0D4;
        }
        .highlight-box.warn {
          background: rgba(236,0,140,0.07);
          border-color: rgba(236,0,140,0.2);
          border-left-color: #EC008C;
        }
        .highlight-box strong { color: #fff; }

        /* Footer */
        .page-footer {
          border-top: 1px solid rgba(0,174,239,0.12);
          padding-top: 2rem; margin-top: 2rem;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 1rem;
          font-size: 0.83rem; color: #8CA0B8;
        }
        .page-footer a { color: #00AEEF; text-decoration: none; }
        .page-footer a:hover { text-decoration: underline; }

        @media (max-width: 600px) {
          .page-header { padding: 2rem 0 1.75rem; }
          .page-footer { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="page-wrap">
        <div className="page-header">
          <Link href="/" className="back-link">← Back to Frankstat</Link>
          <div className="eyebrow">Legal</div>
          <h1 className="page-title">Terms of Service</h1>
          <p className="page-meta">Last updated: <strong>{LAST_UPDATED}</strong></p>
        </div>

        {/* TOC */}
        <nav className="toc" aria-label="Table of contents">
          <div className="toc-title">Contents</div>
          <ol className="toc-list">
            {[
              "Acceptance of Terms",
              "Services Provided",
              "Account Registration",
              "Orders & Artwork",
              "Pricing & Payment",
              "M-Pesa Payments",
              "Production & Delivery",
              "Cancellations & Refunds",
              "Intellectual Property",
              "Limitation of Liability",
              "Prohibited Conduct",
              "Privacy & Data",
              "Amendments",
              "Governing Law",
              "Contact Us",
            ].map((item, i) => (
              <li key={i}>
                <a href={`#s${i + 1}`}>
                  <span className="toc-num">{String(i + 1).padStart(2, "0")}</span>
                  {item}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="highlight-box">
          <strong>Please read these Terms carefully.</strong> By accessing or using the Frankstat platform — including our website, ordering system, and related services — you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
        </div>

        {/* Section 1 */}
        <section className="section" id="s1">
          <div className="section-num">01</div>
          <h2 className="section-title">Acceptance of Terms</h2>
          <p>These Terms of Service ("Terms") constitute a legally binding agreement between you ("Customer", "you") and Frankstat Printing Solutions ("Frankstat", "we", "us", "our"), a printing and branding business based in Nairobi, Kenya.</p>
          <p>By creating an account, placing an order, or using any part of our platform, you confirm that you are at least 18 years old (or have the consent of a legal guardian), and that you have the authority to enter into these Terms.</p>
        </section>

        {/* Section 2 */}
        <section className="section" id="s2">
          <div className="section-num">02</div>
          <h2 className="section-title">Services Provided</h2>
          <p>Frankstat provides professional printing and branding services, including but not limited to:</p>
          <ul className="list">
            <li>Large-format banner and poster printing</li>
            <li>3D signage design and fabrication</li>
            <li>Sublimation printing on garments and merchandise</li>
            <li>Vinyl cutting and application</li>
            <li>Heat-press transfers on clothing and accessories</li>
            <li>Business cards, flyers, and stationery</li>
          </ul>
          <p>We reserve the right to modify, suspend or discontinue any service at any time with reasonable notice. We are not liable for any loss resulting from such changes.</p>
        </section>

        {/* Section 3 */}
        <section className="section" id="s3">
          <div className="section-num">03</div>
          <h2 className="section-title">Account Registration</h2>
          <p>To place an order you must register an account with a valid email address, full name, and a secure password. You are responsible for maintaining the confidentiality of your login credentials.</p>
          <ul className="list">
            <li>You must provide accurate and complete information during registration.</li>
            <li>You are solely responsible for all activity that occurs under your account.</li>
            <li>You must notify us immediately at <strong>support@frankstat.com</strong> if you suspect unauthorised access.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
          </ul>
          <p>Email verification is required before an account can be used to place orders. Unverified accounts will not be processed.</p>
        </section>

        {/* Section 4 */}
        <section className="section" id="s4">
          <div className="section-num">04</div>
          <h2 className="section-title">Orders & Artwork</h2>
          <p>All orders are subject to review and acceptance by Frankstat. Submission of an order does not constitute a binding contract until we confirm acceptance and receive the required payment.</p>
          <ul className="list">
            <li>You are responsible for supplying print-ready artwork in the correct format and resolution. We recommend a minimum of 150 DPI for large formats and 300 DPI for small formats.</li>
            <li>Frankstat is not responsible for print quality issues arising from low-resolution, incorrect colour profiles (we print in CMYK), or design errors in customer-supplied files.</li>
            <li>We offer a free artwork review before production begins. Any design adjustments by Frankstat beyond minor corrections may attract additional charges.</li>
            <li>Orders are confirmed only after artwork approval and deposit payment.</li>
            <li>Artwork files uploaded to our platform are stored securely and used solely for fulfilling your order.</li>
          </ul>
          <div className="highlight-box warn">
            <strong>Colour disclaimer:</strong> Printed colours may vary slightly from on-screen representations due to monitor calibration differences and the CMYK printing process. We are not liable for minor colour deviations.
          </div>
        </section>

        {/* Section 5 */}
        <section className="section" id="s5">
          <div className="section-num">05</div>
          <h2 className="section-title">Pricing & Payment</h2>
          <p>All prices are displayed in Kenyan Shillings (KES) and are inclusive of standard production costs. Delivery, finishing extras, and expedite fees are quoted separately.</p>
          <ul className="list">
            <li>Prices are subject to change without notice. The price displayed at the time of order confirmation is binding for that order.</li>
            <li>A minimum 50% deposit is required to begin production. The remaining balance must be settled before or upon delivery.</li>
            <li>Full upfront payment qualifies for faster processing priority.</li>
            <li>Discount codes are applied at checkout and cannot be combined unless explicitly stated.</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="section" id="s6">
          <div className="section-num">06</div>
          <h2 className="section-title">M-Pesa Payments</h2>
          <p>We process payments via Safaricom M-Pesa (Lipa Na M-Pesa STK Push). By initiating an M-Pesa payment, you agree to Safaricom's applicable terms and conditions.</p>
          <ul className="list">
            <li>You must ensure the M-Pesa number you provide is registered in your name or that you have authority to transact from it.</li>
            <li>Frankstat is not responsible for failed transactions caused by network issues, incorrect PINs, or M-Pesa service downtime.</li>
            <li>M-Pesa transaction receipts are stored and can be accessed from your order dashboard.</li>
            <li>Disputed M-Pesa charges must be reported within 7 days of the transaction date.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="section" id="s7">
          <div className="section-num">07</div>
          <h2 className="section-title">Production & Delivery</h2>
          <p>Production timelines are estimates and begin only after artwork approval and deposit confirmation. Standard turnaround times are:</p>
          <ul className="list">
            <li>Banners and posters: 24–48 hours</li>
            <li>3D signage: 3–7 working days depending on complexity</li>
            <li>Sublimation and heat-press garments: 2–5 working days</li>
            <li>Business cards and stationery: 24–48 hours</li>
          </ul>
          <p>Rush orders may be accommodated at an additional fee, subject to capacity. Frankstat is not liable for delays caused by events beyond our reasonable control, including supplier delays, power outages, or public holidays.</p>
          <div className="highlight-box">
            <strong>Delivery:</strong> Delivery within Nairobi is available at an additional charge quoted at the time of order. You may also collect your order from our premises at no extra cost. Risk of loss passes to you upon delivery or collection.
          </div>
        </section>

        {/* Section 8 */}
        <section className="section" id="s8">
          <div className="section-num">08</div>
          <h2 className="section-title">Cancellations & Refunds</h2>
          <p>You may cancel an order before production has begun for a full refund of any deposit paid, less any payment processing fees. Once production has started, the following applies:</p>
          <ul className="list">
            <li>Orders cancelled after production begins are subject to a 50% cancellation fee covering materials and labour already consumed.</li>
            <li>Orders cannot be cancelled once production is complete.</li>
            <li>If we make an error in your print (wrong size, wrong artwork), we will reprint at no additional cost or issue a full refund.</li>
            <li>Refunds are processed within 5–7 business days via the original payment method.</li>
            <li>No refunds are issued for artwork errors that were approved by the customer.</li>
          </ul>
          <div className="highlight-box warn">
            To initiate a cancellation or refund, open a support ticket from your dashboard within <strong>48 hours</strong> of placing your order or discovering the issue.
          </div>
        </section>

        {/* Section 9 */}
        <section className="section" id="s9">
          <div className="section-num">09</div>
          <h2 className="section-title">Intellectual Property</h2>
          <p>You retain all intellectual property rights to the artwork and designs you upload. By submitting artwork to Frankstat, you grant us a non-exclusive, royalty-free licence to reproduce your artwork solely for the purpose of fulfilling your order.</p>
          <ul className="list">
            <li>You warrant that you own or have the necessary licences for all artwork submitted, and that printing it does not infringe any third-party rights.</li>
            <li>Frankstat reserves the right to refuse any order involving artwork that appears to infringe copyright, trademarks, or any applicable law.</li>
            <li>We may use anonymised or generic examples of our printed work in marketing materials unless you explicitly opt out.</li>
          </ul>
        </section>

        {/* Section 10 */}
        <section className="section" id="s10">
          <div className="section-num">10</div>
          <h2 className="section-title">Limitation of Liability</h2>
          <p>To the maximum extent permitted by Kenyan law, Frankstat's total liability to you for any claim arising out of or relating to these Terms or our services shall not exceed the amount you paid for the specific order giving rise to the claim.</p>
          <p>We are not liable for:</p>
          <ul className="list">
            <li>Indirect, incidental, or consequential losses including lost profits or business interruption</li>
            <li>Losses arising from your failure to back up artwork files</li>
            <li>Delays or failures caused by third-party suppliers, couriers, or M-Pesa</li>
            <li>Damage to printed goods after delivery or collection</li>
          </ul>
        </section>

        {/* Section 11 */}
        <section className="section" id="s11">
          <div className="section-num">11</div>
          <h2 className="section-title">Prohibited Conduct</h2>
          <p>You agree not to use our platform or services to:</p>
          <ul className="list">
            <li>Print or reproduce content that is defamatory, obscene, discriminatory, or incites violence or hatred</li>
            <li>Infringe the intellectual property rights of any third party</li>
            <li>Submit false, misleading, or fraudulent information</li>
            <li>Attempt to gain unauthorised access to our systems or other users' accounts</li>
            <li>Use automated tools to scrape, crawl, or overload our platform</li>
            <li>Engage in any activity that violates applicable Kenyan or international law</li>
          </ul>
          <p>Violation of this section may result in immediate account termination and referral to relevant authorities.</p>
        </section>

        {/* Section 12 */}
        <section className="section" id="s12">
          <div className="section-num">12</div>
          <h2 className="section-title">Privacy & Data</h2>
          <p>Your use of our services is also governed by our <Link href="/privacy" style={{color:"#00AEEF",textDecoration:"none",fontWeight:600}}>Privacy Policy</Link>, which is incorporated into these Terms by reference. By using our services you consent to the collection and use of your information as described therein.</p>
        </section>

        {/* Section 13 */}
        <section className="section" id="s13">
          <div className="section-num">13</div>
          <h2 className="section-title">Amendments</h2>
          <p>We reserve the right to modify these Terms at any time. We will provide at least 14 days' notice of material changes by emailing registered users or posting a notice on our platform. Your continued use of our services after the effective date of any change constitutes acceptance of the updated Terms.</p>
        </section>

        {/* Section 14 */}
        <section className="section" id="s14">
          <div className="section-num">14</div>
          <h2 className="section-title">Governing Law</h2>
          <p>These Terms are governed by and construed in accordance with the laws of the Republic of Kenya. Any dispute arising under these Terms shall be subject to the exclusive jurisdiction of the courts of Nairobi, Kenya.</p>
          <p>We encourage you to contact us first to resolve any dispute informally before commencing legal proceedings.</p>
        </section>

        {/* Section 15 */}
        <section className="section" id="s15">
          <div className="section-num">15</div>
          <h2 className="section-title">Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us:</p>
          <ul className="list">
            <li><strong style={{color:"#fff"}}>Email:</strong> support@frankstat.com</li>
            <li><strong style={{color:"#fff"}}>Phone / WhatsApp:</strong> +254 700 000 000</li>
            <li><strong style={{color:"#fff"}}>Address:</strong> Frankstat Printing Solutions, Nairobi, Kenya</li>
          </ul>
          <p>For account-related disputes, you may also open a support ticket directly from your dashboard.</p>
        </section>

        <div className="page-footer">
          <span>© {new Date().getFullYear()} Frankstat Printing Solutions</span>
          <span>
            <Link href="/privacy">Privacy Policy</Link>
            {" · "}
            <Link href="/">Back to Home</Link>
          </span>
        </div>
      </div>
    </>
  );
}
