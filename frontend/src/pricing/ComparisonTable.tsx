import "./ComparisonTable.css";

// Icons for comparison table
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill="#22c55e" fillOpacity="0.15" />
    <path
      d="M6 10.5L8.5 13L14 7"
      stroke="#22c55e"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill="#ef4444" fillOpacity="0.15" />
    <path
      d="M7 7L13 13M13 7L7 13"
      stroke="#ef4444"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M7 6V10M7 4.5V4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const CrownIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M3 18L5 8L9.5 12L12 6L14.5 12L19 8L21 18H3Z"
      fill="#F97316"
      stroke="#F97316"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ComparisonTable() {
  return (
    <section className="comparison-section">
      <div className="comparison-header">
        <span className="comparison-badge">Why Choose Us?</span>
        <h2>See How We Stack Up</h2>
        <p>
          We're not just another cloud gaming service. Here's why TS (this)
          gamers choose MaddoxCloud.
        </p>
      </div>

      <div className="comparison-table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th className="feature-header">Feature</th>
              <th className="company-header maddox-header">
                <div className="company-cell winner">
                  <CrownIcon />
                  <img
                    src="/imgs/egg_cloud_logo.png"
                    alt="MaddoxCloud"
                    className="company-logo"
                  />
                  <span className="company-name">MaddoxCloud</span>
                </div>
              </th>
              <th className="company-header">
                <div className="company-cell">
                  <img
                    src="/competitors_logos/now_gg.png"
                    alt="Now.gg"
                    className="company-logo"
                  />
                  <span className="company-name">Now.gg</span>
                </div>
              </th>
              <th className="company-header">
                <div className="company-cell">
                  <img
                    src="/competitors_logos/cloudmoon.png"
                    alt="CloudMoon"
                    className="company-logo"
                  />
                  <span className="company-name">CloudMoon</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="feature-cell">
                <span className="feature-name">Latency</span>
                <span className="feature-hint">
                  <InfoIcon />
                  <span className="hint-tooltip">
                    Lower is better for smooth gameplay
                  </span>
                </span>
              </td>
              <td className="value-cell best">
                <span className="value-highlight">60ms</span>
              </td>
              <td className="value-cell">65ms</td>
              <td className="value-cell">80ms</td>
            </tr>
            <tr>
              <td className="feature-cell">
                <span className="feature-name">Works at School</span>
                <span className="feature-hint">
                  <InfoIcon />
                  <span className="hint-tooltip">
                    Bypasses most network restrictions
                  </span>
                </span>
              </td>
              <td className="value-cell">
                <CheckIcon />
              </td>
              <td className="value-cell">
                <XIcon />
              </td>
              <td className="value-cell">
                <XIcon />
              </td>
            </tr>
            <tr>
              <td className="feature-cell">
                <span className="feature-name">Queue Time</span>
                <span className="feature-hint">
                  <InfoIcon />
                  <span className="hint-tooltip">
                    Average wait time in minutes
                  </span>
                </span>
              </td>
              <td className="value-cell best">
                <span className="value-highlight">None</span>
              </td>
              <td className="value-cell">~1 min</td>
              <td className="value-cell">None</td>
            </tr>
            <tr>
              <td className="feature-cell">
                <span className="feature-name">Pricing</span>
              </td>
              <td className="value-cell best">
                <span className="value-highlight">Free</span>
              </td>
              <td className="value-cell">Free</td>
              <td className="value-cell muted">15 min free</td>
            </tr>
            <tr>
              <td className="feature-cell">
                <span className="feature-name">American Company</span>
                <span className="feature-hint">
                  <InfoIcon />
                  <span className="hint-tooltip">
                    Better data privacy & server locations
                  </span>
                </span>
              </td>
              <td className="value-cell">
                <CheckIcon />
              </td>
              <td className="value-cell">
                <XIcon />
              </td>
              <td className="value-cell">
                <XIcon />
              </td>
            </tr>
            <tr>
              <td className="feature-cell">
                <span className="feature-name">Student Owned</span>
                <span className="feature-hint">
                  <InfoIcon />
                  <span className="hint-tooltip">
                    Built by students for students
                  </span>
                </span>
              </td>
              <td className="value-cell">
                <CheckIcon />
              </td>
              <td className="value-cell">
                <XIcon />
              </td>
              <td className="value-cell">
                <XIcon />
              </td>
            </tr>
            <tr>
              <td className="feature-cell">
                <span className="feature-name">No Ads</span>
                <span className="feature-hint">
                  <InfoIcon />
                  <span className="hint-tooltip">
                    Uninterrupted gaming experience
                  </span>
                </span>
              </td>
              <td className="value-cell">
                <CheckIcon />
              </td>
              <td className="value-cell">
                <XIcon />
              </td>
              <td className="value-cell">
                <XIcon />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="comparison-disclaimer">
        * Competitor information was gathered on November 25, 2025 and is
        subject to change. Features and pricing may vary. We recommend verifying
        current details on their respective websites.
      </p>

      <div className="comparison-footer">
        <p>The choice is clear, Lock in your early access spot</p>
      </div>
    </section>
  );
}
