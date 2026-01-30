import "./Pages.css";

export default function TermsOfService() {
  return (
    <div className="page-container">
      <div className="page-content">
        <h1>Terms of Service</h1>
        <p className="page-effective-date">Effective Date: January 30, 2026</p>

        <section className="page-section">
          <h2>Agreement to Terms</h2>
          <p>
            By accessing or using MaddoxCloud ("the Service"), you agree to be bound by
            these Terms of Service ("Terms"). If you disagree with any part of the Terms,
            you may not access the Service.
          </p>
        </section>

        <section className="page-section">
          <h2>Description of Service</h2>
          <p>
            MaddoxCloud is a cloud gaming platform operated by Schmidlkofer Development LLC
            that allows users to stream and play Android games through their web browser
            using WebRTC technology. The Service is provided on a freemium basis: free-tier
            users receive up to 10 minutes of playtime per day at standard video quality,
            while paid subscribers receive unlimited playtime and access to higher video
            quality options.
          </p>
          <p>
            Games available on the platform are third-party Android applications owned by
            their respective developers and publishers. MaddoxCloud does not claim ownership
            of any games streamed through the Service.
          </p>
        </section>

        <section className="page-section">
          <h2>User Accounts</h2>
          <p>
            When you create an account with us, you must provide accurate, complete, and
            current information. Failure to do so constitutes a breach of the Terms, which
            may result in immediate termination of your account.
          </p>
          <p>
            You are responsible for safeguarding the password that you use to access the
            Service and for any activities or actions under your password. You agree not
            to disclose your password to any third party. You must notify us immediately
            upon becoming aware of any breach of security or unauthorized use of your account.
          </p>
        </section>

        <section className="page-section">
          <h2>Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="page-list">
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on the rights of others, including intellectual property rights</li>
            <li>
              Transmit any material that is defamatory, offensive, or otherwise objectionable
            </li>
            <li>
              Attempt to gain unauthorized access to the Service, other accounts, or
              computer systems or networks
            </li>
            <li>
              Interfere with or disrupt the Service or servers or networks connected to
              the Service
            </li>
            <li>Use the Service for any commercial purposes without our express consent</li>
            <li>
              Use any automated means to access the Service for any purpose without our
              express written permission
            </li>
            <li>Abuse, harass, or threaten other users of the Service</li>
          </ul>
        </section>

        <section className="page-section">
          <h2>Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are and will
            remain the exclusive property of MaddoxCloud and its licensors. The Service is
            protected by copyright, trademark, and other laws. Our trademarks and trade
            dress may not be used in connection with any product or service without prior
            written consent.
          </p>
          <p>
            Games and applications accessible through the Service are the property of their
            respective owners. MaddoxCloud does not claim ownership of third-party content.
          </p>
        </section>

        <section className="page-section">
          <h2>Subscriptions and Payments</h2>
          <p>
            Paid subscriptions unlock unlimited playtime and higher video quality options.
            You will be billed in advance on a recurring and periodic basis. Billing cycles
            are set on a monthly or annual basis, depending on the type of subscription plan
            you select.
          </p>
          <p>
            All payments are processed through Stripe, a third-party payment processor. A
            valid payment method is required to process payment for your subscription. You
            shall provide accurate and complete billing information. By submitting such
            payment information, you automatically authorize us to charge all subscription
            fees incurred through your account. MaddoxCloud does not store your full credit
            card details; payment data is handled directly by Stripe in accordance with
            their privacy and security policies.
          </p>
        </section>

        <section className="page-section">
          <h2>Free Tier</h2>
          <p>
            MaddoxCloud offers a free tier that provides up to 10 minutes of playtime per
            day at standard (ULD) video quality. The free tier does not require payment
            information. Free-tier limitations are subject to change at our sole discretion.
            To access unlimited playtime and higher video quality options, you may upgrade
            to a paid subscription at any time.
          </p>
        </section>

        <section className="page-section">
          <h2>Refunds</h2>
          <p>
            Except when required by law, paid subscription fees are non-refundable. Certain
            refund requests for subscriptions may be considered on a case-by-case basis and
            granted at the sole discretion of MaddoxCloud.
          </p>
        </section>

        <section className="page-section">
          <h2>Service Availability</h2>
          <p>
            We do not guarantee that the Service will be available at all times. We may
            experience hardware, software, or other problems or need to perform maintenance
            related to the Service, resulting in interruptions, delays, or errors. We reserve
            the right to change, revise, update, suspend, discontinue, or otherwise modify
            the Service at any time without notice.
          </p>
        </section>

        <section className="page-section">
          <h2>Limitation of Liability</h2>
          <p>
            In no event shall MaddoxCloud, Schmidlkofer Development LLC, or its service
            providers be liable for any indirect, incidental, special, consequential, or
            punitive damages, including without limitation, loss of profits, data, use,
            goodwill, or other intangible losses, resulting from:
          </p>
          <ul className="page-list">
            <li>Your access to or use of or inability to access or use the Service</li>
            <li>Any conduct or content of any third party on the Service</li>
            <li>Any content obtained from the Service</li>
            <li>
              Unauthorized access, use, or alteration of your transmissions or content
            </li>
          </ul>
        </section>

        <section className="page-section">
          <h2>Disclaimer</h2>
          <p>
            Your use of the Service is at your sole risk. The Service is provided on an
            "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties
            of any kind, whether express or implied, including, but not limited to, implied
            warranties of merchantability, fitness for a particular purpose, non-infringement,
            or course of performance.
          </p>
        </section>

        <section className="page-section">
          <h2>Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or
            liability, for any reason whatsoever, including without limitation if you breach
            the Terms. Upon termination, your right to use the Service will immediately cease.
          </p>
        </section>

        <section className="page-section">
          <h2>Changes to Terms</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms
            at any time. If a revision is material, we will try to provide at least 30 days'
            notice prior to any new terms taking effect. What constitutes a material change
            will be determined at our sole discretion.
          </p>
        </section>

        <section className="page-section">
          <h2>Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of the
            State of Indiana, United States, without regard to its conflict of law provisions.
          </p>
        </section>

        <section className="page-section">
          <h2>Dispute Resolution</h2>
          <p>
            If you have any concerns or disputes about the Service, you agree to first try
            to resolve the dispute informally by contacting us at{" "}
            <a href="mailto:contact@maddoxcloud.com">contact@maddoxcloud.com</a>. If the
            dispute is not resolved within 30 days, any formal legal proceedings shall be
            brought exclusively in the courts located in the State of Indiana, United States.
          </p>
        </section>

        <section className="page-section">
          <h2>Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at{" "}
            <a href="mailto:contact@maddoxcloud.com">contact@maddoxcloud.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
