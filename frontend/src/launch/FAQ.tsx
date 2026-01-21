import { useState } from "react";
import { Link } from "react-router-dom";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Want access now?",
    answer: (
      <>
        <Link to="/pricing">Skip the waitlist</Link> and get immediate access
        with one of our plans.
      </>
    ),
  },
  {
    question: "Have questions?",
    answer: (
      <>
        Join our{" "}
        <a
          href="https://discord.gg/U4QYdzXEnr"
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord community
        </a>{" "}
        for support and random invite code drops that give you instant access!
      </>
    ),
  },
  {
    question: "Lost your spot on the waitlist?",
    answer:
      "Check your email, most likely you got an invite code! Look for an email from us with your invite code.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-section">
      <h3 className="faq-title">Frequently Asked Questions</h3>
      <div className="faq-list">
        {FAQ_ITEMS.map((item, index) => (
          <div
            key={index}
            className={`faq-item ${openIndex === index ? "faq-item-open" : ""}`}
          >
            <button
              className="faq-question"
              onClick={() => toggleItem(index)}
              aria-expanded={openIndex === index}
            >
              <span>{item.question}</span>
              <span
                className={`faq-chevron ${openIndex === index ? "open" : ""}`}
              >
                ▼
              </span>
            </button>
            {openIndex === index && (
              <div className="faq-answer">{item.answer}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
