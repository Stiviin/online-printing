import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Frankstat Printing Solutions",
  description: "Frankstat Printing Solutions' Privacy Policy. Learn how we collect, use, and protect your personal data in compliance with Kenyan data protection law.",
};

const LAST_UPDATED = "11 June 2026";

export default function PrivacyPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', system-ui, sans-serif; background: #060D1A; color: #E2EAF4; line-height: 1.7; }

        .page-wrap { max-width: 780px; margin: 0 auto; padding: 0 1.5rem 5rem; }

        .page-header {
          padding: 3rem 0 2.5rem;
          border-bottom: 1px solid rgba(0,174,239,0.15);
          margin-bottom: 3rem;
        }
        .back-link {
          display: inline-flex; align-items: center; gap: 0.4rem;
          color: #8CA0B8; text-decoration: none; font-size: 0.85rem;
          font-weight: 500; margin-bottom: 1.75rem; transition: color 0.2s;
        }
        .back-link:hover { color: #00AEEF; }

        .eyebrow {
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase;
          background: linear-gradient(90deg, #EC008C, #FFE500);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; margin-bottom: 0.75rem;
        }
        .page-title {
          font-size: clamp(2rem, 5vw, 2.8rem); font-weight: 800;
          color: #fff; letter-spacing: -0.03em; line-height: 1.1;
          margin-bottom: 0.75rem;
        }
        .page-meta { font-size: 0.85rem; color: #8CA0B8; }
        .page-meta strong { color: #EC008C; }

        /* TOC */
        .toc {
          background: #0A1525; border: 1px solid rgba(236,0,140,0.15);
          border-radius: 14px; padding: 1.5rem 1.75rem; margin-bottom: 3rem;
        }
        .toc-title {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em;
          text-transform: uppercase; color: #EC008C; margin-bottom: 1rem;
        }
        .toc-list { list-style: none; display: flex; flex-direction: column; gap: 0.45rem; }
        .toc-list li a {
          color: #8CA0B8; text-decoration: none; font-size: 0.87rem;
          font-weight: 500; transition: color 0.2s;
          display: flex; align-items: center; gap: 0.5rem;
        }
        .toc-list li a:hover { color: #EC008C; }
        .toc-num { color: #1E3A5F; font-size: 0.75rem; font-weight: 700; min-width: 22px; }

        /* Sections */
        .section { margin-bottom: 3rem; scroll-margin-top: 2rem; }
        .section-num {
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.15em;
          text-transform: uppercase; color: #00AEEF; margin-bottom: 0.4rem;
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
          content: "→"; color: #EC008C; font-weight: 700;
          flex-shrink: 0; margin-top: 0.02em;
        }

        .data-table {
          width: 100%; border-collapse: collapse; margin: 1rem 0;
          font-size: 0.87rem;
        }
        .data-table th {
          text-align: left; padding: 0.6rem 0.9rem;
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: #EC008C;
          background: rgba(236,0,140,0.06);
          border-bottom: 1px solid rgba(236,0,140,0.15);
        }
        .data-table td {
          padding: 0.65rem 0.9rem; color: #B0C0D4;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          vertical-align: top;
        }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: rgba(255,255,255,0.02); }

        .highlight-box {
          background: rgba(0,174,239,0.07);
          border: 1px solid rgba(0,174,239,0.2);
          border-left: 3px solid #00AEEF;
          border-radius: 8px; padding: 1rem 1.25rem;
          margin: 1rem 0; font-size: 0.88rem; color: #B0C0D4;
        }
        .highlight-box.mag {
          background: rgba(236,0,140,0.06);
          border-color: rgba(236,0,140,0.2);
          border-left-color: #EC008C;
        }
        .highlight-box.yel {
          background: rgba(255,229,0,0.06);
          border-color: rgba(255,229,0,0.2);
          border-left-color: #FFE500;
          color: #B0C0D4;
        }
        .highlight-box strong { color: #fff; }

        .rights-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 0.75rem; margin: 1rem 0;
        }
        .right-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 0.9rem 1rem;
        }
        .right-card-title {
          font-size: 0.8rem; font-weight: 700; color: #00AEEF;
          margin-bottom: 0.3rem;
        }
        .right-card-desc { font-size: 0.82rem; color: #8CA0B8; line-height: 1.5; }

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
          .rights-grid { grid-template-columns: 1fr; }
          .data-table { font-size: 0.78rem; }
          .page-footer { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="page-wrap">
        <div className="page-header">
          <Link href="/" className="back-link">← Back to Frankstat</Link>
          <div className="eyebrow">Legal</div>
          <h1 className="page-title">Privacy Policy</h1>
          <p className="page-meta">Last updated: <strong>{LAST_UPDATED}</strong></p>
        </div>

        <nav className="toc" aria-label="Table of contents">
          <div className="toc-title">Contents</div>
          <ol className="toc-list">
            {[
              "Who We Are",
              "Information We Collect",
              "How We Use Your Information",
              "Legal Basis for Processing",
              "Sharing Your Information",
              "M-Pesa & Payment Data",
              "Cookies & Tracking",
              "Data Retention",
              "Your Rights",
              "Data Security",
              "Children's Privacy",
              "Third-Party Links",
              "Changes to This Policy",
              "Contact & Complaints",
            ].map((item, i) => (
              <li key={i}>
                <a href={`#p${i + 1}`}>
                  <span className="toc-num">{String(i + 1).padStart(2, "0")}</span>
                  {item}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="highlight-box yel">
          <strong>Your privacy matters to us.</strong> This Privacy Policy explains how Frankstat Printing Solutions collects, uses, and protects your personal data in accordance with Kenya's <strong>Data Protection Act, 2019</strong> and applicable regulations. Please read it carefully.
        </div>

        {/* Section 1 */}
        <section className="section" id="p1">
          <div className="section-num">01</div>
          <h2 className="section-title">Who We Are</h2>
          <p>Frankstat Printing Solutions ("Frankstat", "we", "us") is a printing and branding business based in Nairobi, Kenya. We operate the Frankstat website and online ordering platform at frankstat.com.</p>
          <p>For the purposes of the Data Protection Act 2019, Frankstat is the <strong style={{color:"#fff"}}>Data Controller</strong> responsible for your personal information.</p>
          <ul className="list">
            <li><strong style={{color:"#fff"}}>Contact:</strong> support@frankstat.com</li>
            <li><strong style={{color:"#fff"}}>Phone:</strong> +254 700 000 000</li>
            <li><strong style={{color:"#fff"}}>Address:</strong> Nairobi, Kenya</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="section" id="p2">
          <div className="section-num">02</div>
          <h2 className="section-title">Information We Collect</h2>
          <p>We collect information that you provide directly, that we generate through your use of our services, and that we receive from third parties (such as M-Pesa).</p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>What we collect</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style={{color:"#fff"}}>Account Data</strong></td>
                <td>Full name, email address, phone number, password (hashed)</td>
                <td>You (registration)</td>
              </tr>
              <tr>
                <td><strong style={{color:"#fff"}}>Order Data</strong></td>
                <td>Service selected, dimensions, quantity, special notes, artwork files</td>
                <td>You (ordering)</td>
              </tr>
              <tr>
                <td><strong style={{color:"#fff"}}>Payment Data</strong></td>
                <td>M-Pesa phone number, transaction receipt, payment status</td>
                <td>You &amp; Safaricom M-Pesa</td>
              </tr>
              <tr>
                <td><strong style={{color:"#fff"}}>Usage Data</strong></td>
                <td>IP address, pages visited, browser type, timestamps</td>
                <td>Automated collection</td>
              </tr>
              <tr>
                <td><strong style={{color:"#fff"}}>Communications</strong></td>
                <td>Support ticket messages, email correspondence</td>
                <td>You</td>
              </tr>
              <tr>
                <td><strong style={{color:"#fff"}}>Device Data</strong></td>
                <td>Device type, operating system (for security logging)</td>
                <td>Automated collection</td>
              </tr>
            </tbody>
          </table>

          <p>We do not collect sensitive personal data such as biometric data, health information, or government ID numbers.</p>
        </section>

        {/* Section 3 */}
        <section className="section" id="p3">
          <div className="section-num">03</div>
          <h2 className="section-title">How We Use Your Information</h2>
          <ul className="list">
            <li>To create and manage your account</li>
            <li>To process, produce, and deliver your print orders</li>
            <li>To initiate and confirm M-Pesa payments</li>
            <li>To send order status updates, receipts, and invoices via email</li>
            <li>To respond to support tickets and enquiries</li>
            <li>To detect and prevent fraud, abuse, or unauthorised access</li>
            <li>To analyse and improve our platform and services</li>
            <li>To send marketing communications (only with your consent, and you may opt out at any time)</li>
            <li>To comply with legal obligations under Kenyan law</li>
          </ul>
          <p>We do not use your data for automated decision-making that produces significant legal effects without human review.</p>
        </section>

        {/* Section 4 */}
        <section className="section" id="p4">
          <div className="section-num">04</div>
          <h2 className="section-title">Legal Basis for Processing</h2>
          <p>Under Kenya's Data Protection Act 2019, we process your personal data on the following lawful bases:</p>
          <ul className="list">
            <li><strong style={{color:"#fff"}}>Contract:</strong> Processing necessary to fulfil your order and manage your account</li>
            <li><strong style={{color:"#fff"}}>Legitimate Interests:</strong> Security monitoring, fraud prevention, service improvement</li>
            <li><strong style={{color:"#fff"}}>Consent:</strong> Marketing emails and optional communications (withdraw at any time)</li>
            <li><strong style={{color:"#fff"}}>Legal Obligation:</strong> Compliance with Kenyan tax and financial regulations</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="section" id="p5">
          <div className="section-num">05</div>
          <h2 className="section-title">Sharing Your Information</h2>
          <p>We do not sell your personal data. We share it only where necessary:</p>
          <ul className="list">
            <li><strong style={{color:"#fff"}}>Safaricom M-Pesa:</strong> Your phone number and payment details are shared to process M-Pesa transactions</li>
            <li><strong style={{color:"#fff"}}>Supabase (Database):</strong> Our secure cloud database provider stores your account and order data</li>
            <li><strong style={{color:"#fff"}}>Email provider:</strong> We use SMTP to send transactional emails containing your name and order details</li>
            <li><strong style={{color:"#fff"}}>Delivery partners:</strong> Your name and delivery address are shared with courier services when applicable</li>
            <li><strong style={{color:"#fff"}}>Legal authorities:</strong> We may disclose data when required by law, court order, or to protect the rights and safety of persons</li>
          </ul>
          <div className="highlight-box">
            All third-party processors are bound by data processing agreements and are required to handle your data securely and only for the purposes we specify.
          </div>
        </section>

        {/* Section 6 */}
        <section className="section" id="p6">
          <div className="section-num">06</div>
          <h2 className="section-title">M-Pesa & Payment Data</h2>
          <p>We process M-Pesa payments via Safaricom's Daraja API. When you initiate a payment:</p>
          <ul className="list">
            <li>Your M-Pesa phone number is transmitted to Safaricom to trigger the STK push prompt</li>
            <li>Safaricom returns a transaction receipt number which we store against your order</li>
            <li>We store the payment amount, status, and receipt — but never your M-Pesa PIN</li>
            <li>Full card numbers or banking credentials are never collected or stored by Frankstat</li>
          </ul>
          <div className="highlight-box mag">
            <strong>We never store your M-Pesa PIN.</strong> The PIN is entered directly on your handset and is never transmitted to or seen by Frankstat.
          </div>
        </section>

        {/* Section 7 */}
        <section className="section" id="p7">
          <div className="section-num">07</div>
          <h2 className="section-title">Cookies & Tracking</h2>
          <p>We use minimal, essential cookies to operate our platform:</p>
          <ul className="list">
            <li><strong style={{color:"#fff"}}>Session cookie (fs_token):</strong> An HttpOnly, Secure JWT cookie that keeps you signed in for 24 hours. It is never accessible to JavaScript.</li>
          </ul>
          <p>We do not use advertising cookies, cross-site tracking cookies, or analytics platforms that share your data with third parties. You may clear cookies from your browser settings at any time, which will sign you out of your account.</p>
        </section>

        {/* Section 8 */}
        <section className="section" id="p8">
          <div className="section-num">08</div>
          <h2 className="section-title">Data Retention</h2>
          <p>We keep your data only as long as necessary:</p>
          <ul className="list">
            <li><strong style={{color:"#fff"}}>Account data:</strong> Retained for the lifetime of your account, plus 3 years after closure for legal compliance</li>
            <li><strong style={{color:"#fff"}}>Order & payment records:</strong> 7 years (required by Kenyan tax law)</li>
            <li><strong style={{color:"#fff"}}>Artwork files:</strong> 90 days after order completion, unless you request earlier deletion</li>
            <li><strong style={{color:"#fff"}}>Support communications:</strong> 2 years</li>
            <li><strong style={{color:"#fff"}}>Security logs:</strong> 90 days rolling</li>
          </ul>
          <p>When retention periods expire, data is securely deleted or anonymised.</p>
        </section>

        {/* Section 9 */}
        <section className="section" id="p9">
          <div className="section-num">09</div>
          <h2 className="section-title">Your Rights</h2>
          <p>Under the Data Protection Act 2019, you have the following rights regarding your personal data:</p>
          <div className="rights-grid">
            {[
              { title: "Right of Access", desc: "Request a copy of the personal data we hold about you." },
              { title: "Right to Rectification", desc: "Correct inaccurate or incomplete personal data." },
              { title: "Right to Erasure", desc: "Request deletion of your data where there is no compelling reason to retain it." },
              { title: "Right to Restrict Processing", desc: "Ask us to limit how we use your data in certain circumstances." },
              { title: "Right to Data Portability", desc: "Receive your data in a structured, machine-readable format." },
              { title: "Right to Object", desc: "Object to processing based on legitimate interests, including direct marketing." },
              { title: "Right to Withdraw Consent", desc: "Withdraw consent at any time where processing is consent-based." },
              { title: "Right to Complain", desc: "Lodge a complaint with the Office of the Data Protection Commissioner (ODPC) Kenya." },
            ].map((r) => (
              <div key={r.title} className="right-card">
                <div className="right-card-title">{r.title}</div>
                <div className="right-card-desc">{r.desc}</div>
              </div>
            ))}
          </div>
          <p>To exercise any of these rights, email us at <strong style={{color:"#fff"}}>privacy@frankstat.com</strong> with your full name and account email. We will respond within 30 days.</p>
        </section>

        {/* Section 10 */}
        <section className="section" id="p10">
          <div className="section-num">10</div>
          <h2 className="section-title">Data Security</h2>
          <p>We take the security of your personal data seriously and implement industry-standard safeguards:</p>
          <ul className="list">
            <li>All passwords are hashed using bcrypt (cost factor 12) — we never store plain-text passwords</li>
            <li>Authentication sessions use signed JWT tokens stored in HttpOnly, Secure cookies inaccessible to client scripts</li>
            <li>All data is transmitted over HTTPS with TLS encryption</li>
            <li>Our database is hosted on Supabase with encryption at rest</li>
            <li>Access to admin functions is protected by role-based access control and re-validated on every request</li>
            <li>Rate limiting is applied to all authentication endpoints to prevent brute-force attacks</li>
            <li>Administrative actions are logged in an immutable audit trail</li>
          </ul>
          <p>Despite these measures, no system is completely immune to breaches. In the event of a data breach affecting your rights, we will notify you and the ODPC within 72 hours as required by law.</p>
        </section>

        {/* Section 11 */}
        <section className="section" id="p11">
          <div className="section-num">11</div>
          <h2 className="section-title">Children's Privacy</h2>
          <p>Our services are not directed at persons under the age of 18. We do not knowingly collect personal data from children. If you believe a child under 18 has provided us with personal data without parental consent, please contact us and we will delete it promptly.</p>
        </section>

        {/* Section 12 */}
        <section className="section" id="p12">
          <div className="section-num">12</div>
          <h2 className="section-title">Third-Party Links</h2>
          <p>Our platform may contain links to third-party websites (e.g., Safaricom, social media). These sites have their own privacy policies and we are not responsible for their practices. We encourage you to read their policies before providing them with any personal information.</p>
        </section>

        {/* Section 13 */}
        <section className="section" id="p13">
          <div className="section-num">13</div>
          <h2 className="section-title">Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify registered users of material changes by email at least 14 days before they take effect. The "Last updated" date at the top of this page will always reflect the most recent revision.</p>
          <p>Continued use of our services after the effective date of any changes constitutes acceptance of the updated policy.</p>
        </section>

        {/* Section 14 */}
        <section className="section" id="p14">
          <div className="section-num">14</div>
          <h2 className="section-title">Contact & Complaints</h2>
          <p>For any privacy-related queries or to exercise your rights, please contact our Data Protection point of contact:</p>
          <ul className="list">
            <li><strong style={{color:"#fff"}}>Email:</strong> privacy@frankstat.com</li>
            <li><strong style={{color:"#fff"}}>Phone:</strong> +254 700 000 000</li>
          </ul>
          <p>If you are not satisfied with our response, you have the right to lodge a complaint with Kenya's data protection authority:</p>
          <div className="highlight-box">
            <strong>Office of the Data Protection Commissioner (ODPC)</strong><br />
            Website: odpc.go.ke · Email: info@odpc.go.ke<br />
            P.O. Box 30030-00100, Nairobi, Kenya
          </div>
        </section>

        <div className="page-footer">
          <span>© {new Date().getFullYear()} Frankstat Printing Solutions</span>
          <span>
            <Link href="/terms">Terms of Service</Link>
            {" · "}
            <Link href="/">Back to Home</Link>
          </span>
        </div>
      </div>
    </>
  );
}
