import { Icon } from '../../../components/Icon';

const FEATURES = [
  { icon: 'tag' as const, title: 'The tag board', desc: 'See who is on the floor right now, at a glance, from the staff entrance rack.' },
  { icon: 'calendar' as const, title: 'Roster & rest rules', desc: 'Weekly rosters checked against the Labour Proclamation before anything publishes.' },
  { icon: 'banknote' as const, title: 'Payroll, band by band', desc: 'PAYE and pension on versioned rule sets — never a hard-coded rate.' },
];

export default function LoginPage() {
  return (
    <div className="auth">
      <div className="auth__hero">
        <div className="auth__glow" />
        <div className="auth__grid" />
        <div className="auth__content">
          <div className="auth__brand">
            <span className="auth__mark">NC</span>
            <div>
              <div className="auth__brand-name">Noru Crew</div>
              <div className="auth__brand-sub">Noru Booking</div>
            </div>
          </div>

          <h1 className="auth__title">
            Staff operations,
            <br />
            built for Ethiopian hotels.
          </h1>
          <p className="auth__sub">
            Rostering, attendance, leave and payroll — for how hotels in Ethiopia actually run,
            not translated from a system that assumes otherwise.
          </p>

          <div className="auth__features">
            {FEATURES.map((f) => (
              <div key={f.title} className="auth__feature">
                <span className="auth__feature-icon">
                  <Icon name={f.icon} size={17} />
                </span>
                <div>
                  <div className="auth__feature-title">{f.title}</div>
                  <div className="auth__feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth__panel">
        <div className="auth__card">
          <div className="auth__card-head">
            <div className="auth__card-title">Welcome back</div>
            <div className="auth__card-sub">Sign in to your property workspace.</div>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" placeholder="admin@noru.local" disabled />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" placeholder="••••••••••" disabled />
          </div>
          <button type="button" className="btn btn--primary" style={{ width: '100%' }} disabled>
            Sign in
          </button>

          <div className="auth__credentials">
            <strong>Auth isn&rsquo;t wired up yet</strong> — no session cookie, no argon2 check, no RBAC
            middleware (BUILD-PROMPT step 5). The schema, the seeded demo user (
            <span className="mono">admin@noru.local</span>), and <span className="mono">src/lib/db/scope.ts</span>&rsquo;s
            <span className="mono"> withScope</span> are ready for it. Every page under{' '}
            <span className="mono">(app)</span> currently reads as that demo user directly — head{' '}
            <span className="mono">there</span> to see it.
          </div>
        </div>
      </div>
    </div>
  );
}
