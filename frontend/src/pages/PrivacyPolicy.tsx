import "./Pages.css";

export default function PrivacyPolicy() {
  return (
    <div className="page-container">
      <div className="page-content">
        <h1>Privacy Policy</h1>
        <p className="page-effective-date">Effective Date: January 1, 2025</p>

        <section className="page-section">
          <p>
            Maddox Schmidlkofer built the MaddoxCloud app as a freemium service.
            This SERVICE is provided by Maddox Schmidlkofer at no cost and is
            intended for use as is.
          </p>
          <p>
            This page informs visitors about policies regarding the collection,
            use, and disclosure of Personal Information for anyone who uses this
            Service.
          </p>
          <p>
            By using the Service, you agree to the collection and use of
            information as outlined in this policy. The Personal Information
            collected is used for providing and improving the Service. Your
            information will not be shared with third parties except as
            described in this Privacy Policy.
          </p>
        </section>

        <section className="page-section">
          <h2>Information Collection and Use</h2>
          <p>
            For a better experience while using our Service, we may require you
            to provide us with certain personally identifiable information,
            including but not limited to:
          </p>
          <ul className="page-list">
            <li>Name</li>
            <li>Avatar</li>
            <li>Email address</li>
            <li>Authentication tokens</li>
          </ul>
          <p>
            The app uses third-party services that may collect information used
            to identify you:
          </p>
          <ul className="page-list">
            <li>Google Play Services</li>
            <li>Google Analytics</li>
            <li>Supabase</li>
          </ul>
        </section>

        <section className="page-section">
          <h2>Log Data</h2>
          <p>
            Whenever you use our Service, in the case of an error in the app, we
            collect data and information (through third-party products) called
            Log Data. This Log Data may include information such as your
            device's Internet Protocol ("IP") address, device name, operating
            system version, the configuration of the app when utilizing our
            Service, the time and date of your use of the Service, and other
            statistics.
          </p>
        </section>

        <section className="page-section">
          <h2>Cookies</h2>
          <p>
            Cookies are files with a small amount of data that are commonly used
            as anonymous unique identifiers. These are sent to your browser from
            the websites that you visit and are stored on your device's internal
            memory.
          </p>
          <p>
            This Service does not use "cookies" explicitly. However, the app may
            use third-party code and libraries that use "cookies" to collect
            information and improve their services. You have the option to
            either accept or refuse these cookies and know when a cookie is
            being sent to your device. If you choose to refuse our cookies, you
            may not be able to use some portions of this Service.
          </p>
        </section>

        <section className="page-section">
          <h2>Service Providers</h2>
          <p>
            We may employ third-party companies and individuals for the
            following reasons:
          </p>
          <ul className="page-list">
            <li>To facilitate our Service</li>
            <li>To provide the Service on our behalf</li>
            <li>To perform Service-related services</li>
            <li>To assist us in analyzing how our Service is used</li>
          </ul>
          <p>
            These third parties have access to your Personal Information only to
            perform these tasks on our behalf and are obligated not to disclose
            or use the information for any other purpose.
          </p>
        </section>

        <section className="page-section">
          <h2>Security</h2>
          <p>
            We value your trust in providing us your Personal Information, thus
            we strive to use commercially acceptable means of protecting it. But
            remember that no method of transmission over the internet, or method
            of electronic storage is 100% secure and reliable, and we cannot
            guarantee its absolute security.
          </p>
        </section>

        <section className="page-section">
          <h2>Links to Other Sites</h2>
          <p>
            This Service may contain links to other sites. If you click on a
            third-party link, you will be directed to that site. Note that these
            external sites are not operated by us. Therefore, we strongly advise
            you to review the Privacy Policy of these websites. We have no
            control over and assume no responsibility for the content, privacy
            policies, or practices of any third-party sites or services.
          </p>
        </section>

        <section className="page-section">
          <h2>Children's Privacy</h2>
          <p>
            These Services do not address anyone under the age of 13. We do not
            knowingly collect personally identifiable information from children
            under 13 years of age. In the case we discover that a child under 13
            has provided us with personal information, we immediately delete
            this from our servers. If you are a parent or guardian and you are
            aware that your child has provided us with personal information,
            please contact us so that we can take necessary actions.
          </p>
        </section>

        <section className="page-section">
          <h2>Changes to This Privacy Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. Thus, you are
            advised to review this page periodically for any changes. We will
            notify you of any changes by posting the new Privacy Policy on this
            page.
          </p>
        </section>

        <section className="page-section">
          <h2>Contact Us</h2>
          <p>
            If you have any questions or suggestions about our Privacy Policy,
            do not hesitate to contact us at{" "}
            <a href="mailto:contact@maddoxcloud.com">contact@maddoxcloud.com</a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
