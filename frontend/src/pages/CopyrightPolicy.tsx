import "./Pages.css";

export default function CopyrightPolicy() {
  return (
    <div className="page-container">
      <div className="page-content">
        <h1>Copyright Policy</h1>
        <p className="page-effective-date">Effective Date: January 1, 2025</p>

        <section className="page-section">
          <h2>Respect for Intellectual Property</h2>
          <p>
            MaddoxCloud respects the intellectual property rights of others and expects
            users of the Service to do the same. We will respond to notices of alleged
            copyright infringement that comply with applicable law and are properly
            provided to us.
          </p>
        </section>

        <section className="page-section">
          <h2>DMCA Notice Requirements</h2>
          <p>
            If you believe that your copyrighted work has been copied in a way that
            constitutes copyright infringement and is accessible on this Service, please
            notify our copyright agent as set forth in the Digital Millennium Copyright
            Act of 1998 (DMCA). For your complaint to be valid under the DMCA, you must
            provide the following information in writing:
          </p>
          <ol className="page-list-ordered">
            <li>
              An electronic or physical signature of a person authorized to act on behalf
              of the copyright owner
            </li>
            <li>
              Identification of the copyrighted work that you claim has been infringed
            </li>
            <li>
              Identification of the material that is claimed to be infringing and where
              it is located on the Service
            </li>
            <li>
              Information reasonably sufficient to permit us to contact you, such as your
              address, telephone number, and email address
            </li>
            <li>
              A statement that you have a good faith belief that use of the material in
              the manner complained of is not authorized by the copyright owner, its agent,
              or law
            </li>
            <li>
              A statement, made under penalty of perjury, that the above information is
              accurate, and that you are the copyright owner or are authorized to act on
              behalf of the owner
            </li>
          </ol>
        </section>

        <section className="page-section">
          <h2>Counter-Notification</h2>
          <p>
            If you believe that your content that was removed (or to which access was
            disabled) is not infringing, or that you have the authorization from the
            copyright owner, the copyright owner's agent, or pursuant to the law, to
            upload and use the content, you may send a counter-notification containing
            the following information to the copyright agent:
          </p>
          <ol className="page-list-ordered">
            <li>Your physical or electronic signature</li>
            <li>
              Identification of the content that has been removed or to which access has
              been disabled and the location at which the content appeared before it was
              removed or disabled
            </li>
            <li>
              A statement that you have a good faith belief that the content was removed
              or disabled as a result of mistake or a misidentification of the content
            </li>
            <li>
              Your name, address, telephone number, and email address, a statement that
              you consent to the jurisdiction of the federal court located in your
              jurisdiction, and a statement that you will accept service of process from
              the person who provided notification of the alleged infringement
            </li>
          </ol>
          <p>
            If a counter-notification is received by the copyright agent, we will send a
            copy of the counter-notification to the original complaining party informing
            that person that we may replace the removed content or cease disabling it in
            10 business days. Unless the copyright owner files an action seeking a court
            order against the content provider, member or user, the removed content may
            be replaced, or access to it restored, in 10 to 14 business days or more
            after receipt of the counter-notice, at our sole discretion.
          </p>
        </section>

        <section className="page-section">
          <h2>Repeat Infringer Policy</h2>
          <p>
            In accordance with the DMCA and other applicable law, we have adopted a
            policy of terminating, in appropriate circumstances and at our sole discretion,
            users who are deemed to be repeat infringers. We may also at our sole discretion
            limit access to the Service and/or terminate the accounts of any users who
            infringe any intellectual property rights of others, whether or not there is
            any repeat infringement.
          </p>
        </section>

        <section className="page-section">
          <h2>Third-Party Content</h2>
          <p>
            MaddoxCloud is a cloud gaming platform that allows users to stream games. The
            games available on our platform are the property of their respective owners.
            MaddoxCloud does not claim ownership of any games or applications streamed
            through our Service. Users are responsible for ensuring they have the right
            to access and use any games through our platform.
          </p>
        </section>

        <section className="page-section">
          <h2>Contact Information</h2>
          <p>
            Please send all copyright infringement notices and counter-notifications to:
          </p>
          <p className="page-contact-info">
            <strong>MaddoxCloud Copyright Agent</strong><br />
            Email: <a href="mailto:copyright@maddoxcloud.com">copyright@maddoxcloud.com</a><br />
            Alternative: <a href="mailto:contact@maddoxcloud.com">contact@maddoxcloud.com</a>
          </p>
          <p>
            Please note that this procedure is exclusively for notifying us that your
            copyrighted material has been infringed. It does not provide legal advice.
          </p>
        </section>
      </div>
    </div>
  );
}
