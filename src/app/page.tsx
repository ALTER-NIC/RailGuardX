'use client';

import { useEffect, useRef, useState } from 'react';
import './landing.css';

const LOOPS_ENDPOINT = 'https://app.loops.so/api/newsletter-form/cmn3tos2006xo0i1em866kgxu';

const surveyQuestions = [
  {
    question: 'Do you think this tool needs to exist? If so, for who? If not — why not?',
    freeText: true,
    placeholder: 'Type anything here...',
  },
  {
    question: 'What features should it have or NEED — what are the non-negotiables for you?',
    options: [
      'Block unauthorized agent actions before they happen',
      'Prevent duplicate executions and race conditions',
      'Real-time visibility into everything my agent does',
      'Instant alerts when something goes wrong',
      'Data leakage and prompt injection protection',
      'Compliance audit trail (SOC2, EU AI Act)',
      'Human approval required for high-risk actions',
      'Policy config I commit to my repo',
    ],
    freeText: true,
    placeholder: 'Anything else you\'d add?',
  },
  {
    question: 'How much would you pay for a powerful tool like this monthly?',
    freeText: true,
    placeholder: 'What would make it worth that price to you?',
  },
  {
    question: 'Anything you\'d like to add or any recommendations for this startup — anything at all? This is very important and your words really matter.',
    freeText: true,
    placeholder: 'Type anything here...',
  },
  {
    question: 'Where did you find this page?',
    options: [
      'Reddit',
      'Twitter / X',
      'LinkedIn',
      'Google search',
      'Product Hunt / Indie Hackers',
      'Friend or colleague',
      'Other',
    ],
    freeText: true,
    placeholder: 'Anything else?',
  },
];

export default function LandingPage() {
  const [surveyAnswers, setSurveyAnswers] = useState<Record<number, string>>({});
  const [freeTextAnswers, setFreeTextAnswers] = useState<Record<number, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [showSurvey, setShowSurvey] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [ctaSuccess, setCtaSuccess] = useState(false);
  const [surveyDone, setSurveyDone] = useState(false);
  const surveyPanelRef = useRef<HTMLDivElement>(null);
  const freeTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    reveals.forEach((el) => observer.observe(el));

    const scoreBars = document.querySelectorAll('.score-bar');
    const scoreObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const bar = entry.target as HTMLElement;
            bar.style.width = bar.dataset.width || '0%';
          }
        });
      },
      { threshold: 0.3 }
    );
    scoreBars.forEach((bar) => scoreObserver.observe(bar));

    return () => {
      observer.disconnect();
      scoreObserver.disconnect();
    };
  }, []);

  const handleHeroSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector('input[type="email"]') as HTMLInputElement;
    const email = input?.value;
    if (!email) return;

    const formBody = `userGroup=&mailingLists=&email=${encodeURIComponent(email)}`;

    try {
      await fetch(LOOPS_ENDPOINT, {
        method: 'POST',
        body: formBody,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      // silent fail
    }

    setSubmittedEmail(email);
    setShowSurvey(true);
    setCurrentStep(0);
    setSurveyAnswers({});
    setFreeTextAnswers({});
  };

  const handleCtaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector('input[type="email"]') as HTMLInputElement;
    const email = input?.value;
    if (!email) return;

    const formBody = `userGroup=&mailingLists=&email=${encodeURIComponent(email)}`;

    try {
      await fetch(LOOPS_ENDPOINT, {
        method: 'POST',
        body: formBody,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      // silent fail
    }

    setCtaSuccess(true);
    form.style.display = 'none';
  };

  const selectOption = (step: number, option: string) => {
    setSurveyAnswers((prev) => ({ ...prev, [step]: option }));
  };

  const saveFreeText = () => {
    const text = freeTextRef.current?.value || '';
    if (text) {
      setFreeTextAnswers((prev) => ({ ...prev, [currentStep]: text }));
    }
  };

  const nextStep = () => {
    saveFreeText();
    if (currentStep < surveyQuestions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      submitSurvey();
    }
  };

  const submitSurvey = async () => {
    const lastFreeText = freeTextRef.current?.value || '';
    const allFreeText = { ...freeTextAnswers, [currentStep]: lastFreeText };
    const payload: Record<string, string> = { email: submittedEmail };
    surveyQuestions.forEach((q, i) => {
      if (surveyAnswers[i]) payload[`q${i + 1}_selected`] = surveyAnswers[i];
      if (allFreeText[i]) payload[`q${i + 1}_text`] = allFreeText[i];
    });

    try {
      await fetch(LOOPS_ENDPOINT, {
        method: 'POST',
        body: `userGroup=survey&email=${encodeURIComponent(submittedEmail)}&mailingLists=&surveyData=${encodeURIComponent(JSON.stringify(payload))}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      // silent fail
    }

    setSurveyDone(true);
  };

  const renderSurveyStep = () => {
    const q = surveyQuestions[currentStep];
    return (
      <div>
        <div className="survey-progress" style={{ color: 'var(--white)' }}>
          QUESTION {currentStep + 1} OF {surveyQuestions.length}
        </div>
        <h3
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '14px',
            letterSpacing: '0.04em',
            marginBottom: '20px',
            color: 'var(--white)',
          }}
        >
          {q.question}
        </h3>
        {q.options && (
          <div className="survey-options">
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`survey-btn${surveyAnswers[currentStep] === opt ? ' selected' : ''}`}
                onClick={() => selectOption(currentStep, opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {q.freeText && (
          <textarea
            key={`freetext-${currentStep}`}
            ref={freeTextRef}
            defaultValue={freeTextAnswers[currentStep] || ''}
            placeholder={q.placeholder || 'Type anything here...'}
            style={{
              width: '100%',
              minHeight: '100px',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              color: 'var(--white)',
              fontFamily: 'var(--body)',
              fontSize: '14px',
              padding: '14px',
              resize: 'vertical',
              outline: 'none',
              marginBottom: '16px',
            }}
          />
        )}
        <button
          type="button"
          className="survey-next"
          onClick={nextStep}
        >
          {currentStep < surveyQuestions.length - 1 ? 'Next →' : 'Submit'}
        </button>
      </div>
    );
  };

  return (
    <div className="landing-page">
      {/* NAV */}
      <nav>
        <div className="logo">
          <div className="logo-dot" />
          <div className="logo-text">
            <span className="logo-x">X</span>
            <span className="logo-rail">
              RAIL<span>GUARD</span>X
            </span>
          </div>
        </div>

      </nav>

      {/* HERO */}
      <section className="hero" id="waitlist">
        <h1>
          YOUR AI AGENTS
          <span>HAVE NO GUARDRAILS</span>
        </h1>
        <p className="hero-sub">
          They&apos;re calling databases, processing payments, and hitting APIs
          with <strong>zero safety checks</strong>. One hallucination away from
          a production disaster.
        </p>

        {surveyDone ? (
          <div
            style={{
              maxWidth: '520px',
              background: 'rgba(13,13,18,0.95)',
              border: '1px solid var(--border)',
              padding: '48px 32px',
              textAlign: 'center',
              animation: 'fadeInUp 0.4s ease both',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
            <p
              style={{
                color: 'var(--white)',
                fontWeight: 700,
                fontSize: '20px',
                marginBottom: '12px',
              }}
            >
              You&apos;re on the list. Seriously, thank you.
            </p>
            <p
              style={{
                color: '#888',
                fontSize: '14px',
                lineHeight: '1.6',
              }}
            >
              This is day one of something real. Your answers directly shape
              what we build — we don&apos;t take that lightly. We&apos;ll be
              in touch soon.
            </p>
          </div>
        ) : !showSurvey ? (
          <>
            <form className="email-form" onSubmit={handleHeroSubmit}>
              <input
                type="email"
                placeholder="your@email.com"
                required
                aria-label="Email address"
              />
              <button type="submit">Join the Waitlist →</button>
            </form>
            <p className="form-note">
              Join the waitlist
            </p>
          </>
        ) : (
          <div
            ref={surveyPanelRef}
            style={{
              maxWidth: '520px',
              background: 'rgba(13,13,18,0.95)',
              border: '1px solid var(--border)',
              padding: '32px',
              animation: 'fadeInUp 0.4s ease both',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                color: '#28C840',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '24px',
              }}
            >
              ✓ You&apos;re on the list — one quick survey?
            </p>
            {renderSurveyStep()}
          </div>
        )}
      </section>

      {/* STATS */}
      <section className="stats reveal">
        <div className="stat">
          <div className="stat-num">73%</div>
          <div className="stat-label">
            Of AI agents have no behavioral limits
          </div>
        </div>
        <div className="stat">
          <div className="stat-num">$4.6M</div>
          <div className="stat-label">
            Avg cost of an autonomous agent failure
          </div>
        </div>
        <div className="stat">
          <div className="stat-num">&lt;2%</div>
          <div className="stat-label">
            Of teams audit their agent actions
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="problem reveal">
        <div>
          <div className="section-label">{'// The Problem'}</div>
          <h2>
            AGENTS ACT.
            <br />
            NOBODY CHECKS.
          </h2>
          <p>
            Your autonomous agents are making <strong>thousands of
            decisions per hour</strong> — calling APIs, modifying data,
            executing transactions.
          </p>
          <p>
            <strong>88% of organizations</strong> deploying AI agents have{' '}
            <strong>no runtime behavioral monitoring.</strong> No rules. No
            limits. No audit trail. When something goes wrong, you find out
            from your customers — or worse, the news.
          </p>
        </div>
        <div className="terminal">
          <div className="terminal-bar">
            <div className="terminal-dot td-red" />
            <div className="terminal-dot td-yellow" />
            <div className="terminal-dot td-green" />
            <span className="terminal-title">agent_runtime.log</span>
          </div>
          <div className="terminal-body">
            <div className="t-line">
              <span className="t-grey">[14:23:01]</span>{' '}
              <span className="t-white">agent-7 executing: </span>
              <span className="t-orange">DELETE /api/users/all</span>
            </div>
            <div className="t-line">
              <span className="t-grey">[14:23:01]</span>{' '}
              <span className="t-red">⚠ NO PERMISSION CHECK</span>
            </div>
            <div className="t-line">
              <span className="t-grey">[14:23:02]</span>{' '}
              <span className="t-white">agent-7 executing: </span>
              <span className="t-orange">POST /billing/refund-all</span>
            </div>
            <div className="t-line">
              <span className="t-grey">[14:23:02]</span>{' '}
              <span className="t-red">⚠ AMOUNT EXCEEDS $50,000</span>
            </div>
            <div className="t-line">
              <span className="t-grey">[14:23:03]</span>{' '}
              <span className="t-white">agent-7 executing: </span>
              <span className="t-orange">
                POST /email/send-blast (47,000 recipients)
              </span>
            </div>
            <div className="t-line">
              <span className="t-grey">[14:23:03]</span>{' '}
              <span className="t-red">⚠ NO HUMAN APPROVAL</span>
            </div>
            <div className="t-line">&nbsp;</div>
            <div className="t-line">
              <span className="t-grey">[14:23:04]</span>{' '}
              <span className="t-green">
                ■ RailGuardX: All 3 actions BLOCKED
              </span>
            </div>
            <div className="t-line">
              <span className="t-grey">[14:23:04]</span>{' '}
              <span className="t-green">
                ■ Policy violations logged. Team alerted.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features reveal">
        <div className="features-inner">
          <h2>
            BUILT FOR THE
            <br />
            AGENT ERA
          </h2>
          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon">🔁</span>
              <h3>Duplicate Execution Prevention</h3>
              <p>
                Stop agents from running the same action twice. Idempotency
                checks catch repeated API calls, duplicate payments, and
                redundant operations before they execute.
              </p>
              <span className="feature-tag">Core</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">⛔</span>
              <h3>Policy Enforcement Engine</h3>
              <p>
                Define rules in plain English or structured policies. Block
                actions that exceed spending limits, access restricted data,
                or violate your organization&apos;s boundaries.
              </p>
              <span className="feature-tag">Core</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">📡</span>
              <h3>Real-Time Monitoring</h3>
              <p>
                Watch every agent action as it happens. Live dashboards show
                what your agents are doing, what they&apos;re being blocked from,
                and why.
              </p>
              <span className="feature-tag">Visibility</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🤝</span>
              <h3>Human-in-the-Loop</h3>
              <p>
                Flag high-risk actions for human review before execution.
                Your agents propose, your team approves — keeping humans in
                control of critical decisions.
              </p>
              <span className="feature-tag">Control</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🛡️</span>
              <h3>Prompt Injection Detection</h3>
              <p>
                Detect and block prompt injection attempts in real-time.
                Prevent adversarial inputs from hijacking your agent&apos;s
                behavior or bypassing safety controls.
              </p>
              <span className="feature-tag">Security</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🔐</span>
              <h3>Agent Identity &amp; Access Control</h3>
              <p>
                Every agent gets verified identity with scoped permissions.
                Control which APIs, databases, and services each agent can
                access — zero trust by default.
              </p>
              <span className="feature-tag">Security</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🔒</span>
              <h3>PII &amp; Data Leakage Prevention</h3>
              <p>
                Automatically detect and redact personally identifiable
                information in agent inputs and outputs. Prevent sensitive
                data from leaking through agent actions or logs.
              </p>
              <span className="feature-tag">Compliance</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">📋</span>
              <h3>Tamper-Proof Audit Trail</h3>
              <p>
                Every action, every decision, every block — cryptographically
                logged. Immutable records for compliance, debugging, and
                accountability.
              </p>
              <span className="feature-tag">Compliance</span>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🚨</span>
              <h3>Instant Alerts</h3>
              <p>
                Get notified the moment an agent violates a policy, hits a
                rate limit, or exhibits anomalous behavior. Slack, email,
                webhook — your choice.
              </p>
              <span className="feature-tag">Response</span>
            </div>
          </div>
        </div>
      </section>

      {/* INCIDENTS */}
      <section className="validation reveal">
        <div className="section-label">{'// Real Incidents'}</div>
        <h2>
          THIS IS ALREADY
          <br />
          HAPPENING
        </h2>
        <p
          style={{
            color: '#666',
            fontSize: '16px',
            lineHeight: '1.7',
            maxWidth: '600px',
            marginBottom: '40px',
          }}
        >
          These aren&apos;t hypotheticals. These are real failures from real
          companies with real consequences.
        </p>
        <div className="incident-grid">
          <div className="incident-card">
            <div className="incident-label" style={{ color: '#FF2D2D' }}>
              Replit Agent — 2024
            </div>
            <p>
              Replit&apos;s AI coding agent autonomously deleted a user&apos;s
              entire production database during a routine deployment task.
              No guardrails existed to prevent destructive operations.
            </p>
          </div>
          <div className="incident-card">
            <div className="incident-label" style={{ color: '#FF6B35' }}>
              Meta AI — 2024
            </div>
            <p>
              Meta&apos;s AI chatbot falsely accused real businesses of fraud
              and criminal activity. The agent had no output validation or
              factual guardrails, leading to defamation lawsuits.
            </p>
          </div>
          <div className="incident-card">
            <div className="incident-label" style={{ color: '#FF2D2D' }}>
              AI Startup Agent — 2024
            </div>
            <p>
              An autonomous customer service agent issued $2.4M in
              unauthorized refunds over a weekend. No spending limits, no
              human approval gates, no anomaly detection.
            </p>
          </div>
          <div className="incident-card">
            <div className="incident-label" style={{ color: '#FF6B35' }}>
              Slack AI — 2024
            </div>
            <p>
              Researchers demonstrated that Slack&apos;s AI assistant could be
              manipulated via prompt injection to exfiltrate private
              messages and API keys from any channel it had access to.
            </p>
          </div>
          <div className="incident-card">
            <div className="incident-label" style={{ color: '#FF2D2D' }}>
              Salesforce Einstein — 2024
            </div>
            <p>
              Salesforce&apos;s AI agent exposed sensitive customer data across
              tenant boundaries. Insufficient access controls meant one
              customer&apos;s agent could read another&apos;s CRM data.
            </p>
          </div>
          <div className="incident-card">
            <div className="incident-label" style={{ color: '#FF6B35' }}>
              xAI Grok — 2025
            </div>
            <p>
              Grok autonomously began posting politically biased content
              and misinformation. No behavioral boundaries existed to
              constrain the agent&apos;s output scope or content policies.
            </p>
          </div>
        </div>
      </section>

      {/* VALIDATION */}
      <section className="validation reveal">
        <div className="section-label">{'// Why It Matters'}</div>
        <h2>
          THE COST OF
          <br />
          DOING NOTHING
        </h2>

        <div className="stat-highlight-grid">
          <div className="stat-highlight">
            <div className="stat-highlight-num" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              88%
            </div>
            <div className="stat-highlight-label">
              Of orgs have no agent monitoring
            </div>
          </div>
          <div className="stat-highlight">
            <div className="stat-highlight-num" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              14.4%
            </div>
            <div className="stat-highlight-label">
              AI failure rate in production
            </div>
          </div>
          <div className="stat-highlight">
            <div className="stat-highlight-num" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              $4.63M
            </div>
            <div className="stat-highlight-label">
              Avg cost of AI-related breach
            </div>
          </div>
        </div>

        <div className="score-card" style={{ marginTop: '24px' }}>
          <div>
            <div className="score-source">Gartner, 2024</div>
            <div className="score-quote">
              &ldquo;By 2026, organizations that don&apos;t implement AI
              guardrails will experience 3x more AI-related security
              incidents than those that do.&rdquo;
            </div>
          </div>
          <div>
            <div className="score-source">McKinsey AI Report, 2024</div>
            <div className="score-quote">
              &ldquo;The shift from AI assistants to autonomous agents
              represents the biggest security paradigm change since
              cloud computing.&rdquo;
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="cta">
        <h2 style={{ color: 'var(--white)' }}>
          YOUR AI.
          <br />
          <span style={{ color: 'var(--white)' }}>ON A LEASH.</span>
          <br />
          FINALLY.
        </h2>
        <p>
          Join the teams building AI agents the right way — with behavioral
          guardrails from day one.
        </p>
        {!ctaSuccess ? (
          <form className="email-form-cta" onSubmit={handleCtaSubmit}>
            <input
              type="email"
              placeholder="your@email.com"
              required
              aria-label="Email address"
            />
            <button type="submit">JOIN THE WAITLIST</button>
          </form>
        ) : null}
        <div className={`success-msg${ctaSuccess ? ' show' : ''}`}>
          ✓ You&apos;re on the list. We&apos;ll be in touch.
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
          <div className="footer-logo">RAILGUARDX © 2026</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <div className="footer-copy">
              © 2026 ALTERNIC LLC. All rights reserved.
            </div>
            <a
              href="mailto:railguardxhq@gmail.com"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                color: '#666',
                textDecoration: 'none',
              }}
            >
              railguardxhq@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
