import Link from 'next/link';
import { withScope } from '../../../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID } from '../../../../../lib/demo';
import { formatBirr, santim } from '../../../../../lib/domain';
import { Icon } from '../../../../../components/Icon';

export const dynamic = 'force-dynamic';

interface EarningLine { code: string; label: string; amountSantim: number; taxable: boolean; pensionable: boolean }
interface DeductionLine { code: string; label: string; amountSantim: number }
interface TaxBand { fromSantim: number; toSantim: number | null; rate: number; taxableInBandSantim: number; taxSantim: number }

interface PayslipDetail {
  id: string;
  employee_no: string;
  legal_name: string;
  position_title: string;
  department_name: string;
  basic_salary_santim: string;
  prorated_basic_santim: string;
  gross_santim: string;
  taxable_gross_santim: string;
  paye_santim: string;
  employee_pension_santim: string;
  employer_pension_santim: string;
  total_deductions_santim: string;
  net_pay_santim: string;
  employer_cost_santim: string;
  earning_lines: EarningLine[];
  deduction_lines: DeductionLine[];
  tax_bands: TaxBand[];
  warnings: string[];
}

const money = (v: string | number) => formatBirr(santim(Number(v)));
const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

export default async function PayslipDetailPage({ params }: { params: Promise<{ runId: string; employeeId: string }> }) {
  const { runId, employeeId } = await params;

  const [slip] = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<PayslipDetail[]>`
      SELECT id, employee_no, legal_name, position_title, department_name,
             basic_salary_santim::text, prorated_basic_santim::text, gross_santim::text, taxable_gross_santim::text,
             paye_santim::text, employee_pension_santim::text, employer_pension_santim::text,
             total_deductions_santim::text, net_pay_santim::text, employer_cost_santim::text,
             earning_lines, deduction_lines, tax_bands, warnings
      FROM payroll.payslips
      WHERE run_id = ${runId} AND employee_id = ${employeeId}`,
  );

  if (!slip) {
    return (
      <main className="page">
        <section className="card">
          <div className="empty">
            <Icon name="banknote" size={30} />
            <h4>Payslip not found</h4>
            <p><Link href={`/payroll/${runId}`} style={{ color: 'var(--enamel)' }}>Back to run</Link></p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <p>
        <Link href={`/payroll/${runId}`} className="mono muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12.5 }}>
          <Icon name="chevronLeft" size={13} />
          Payroll run
        </Link>
      </p>

      <header className="page__head">
        <div>
          <span className="page__eyebrow">{slip.department_name} · {slip.position_title}</span>
          <h1>{slip.legal_name}</h1>
          <p className="page__sub mono">{slip.employee_no}</p>
        </div>
        <div className="detail-head__actions">
          <span className="kpi__value" style={{ fontSize: 22 }}>{money(slip.net_pay_santim)}</span>
        </div>
      </header>

      {slip.warnings.length > 0 && (
        <div className="banner banner--error">
          {slip.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      <div className="panels-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        <section className="card">
          <header className="card__head"><h2 className="card__title">Earnings</h2></header>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Line</th><th>Taxable</th><th>Pensionable</th><th>Amount</th></tr></thead>
              <tbody>
                {slip.earning_lines.map((line) => (
                  <tr key={line.code}>
                    <td>{line.label}</td>
                    <td>{line.taxable ? <Icon name="check" size={14} /> : <span className="muted">—</span>}</td>
                    <td>{line.pensionable ? <Icon name="check" size={14} /> : <span className="muted">—</span>}</td>
                    <td className="mono">{money(line.amountSantim)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontWeight: 600 }}>Gross</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{money(slip.gross_santim)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="card">
          <header className="card__head"><h2 className="card__title">Deductions</h2></header>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Line</th><th>Amount</th></tr></thead>
              <tbody>
                {slip.deduction_lines.map((line) => (
                  <tr key={line.code}>
                    <td>{line.label}</td>
                    <td className="mono">{money(line.amountSantim)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total deductions</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{money(slip.total_deductions_santim)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">PAYE — band by band</h2>
          <span className="card__note mono">taxable gross {money(slip.taxable_gross_santim)}</span>
        </header>
        {slip.tax_bands.length === 0 ? (
          <div className="empty">
            <Icon name="scale" size={26} />
            <h4>No band breakdown stored</h4>
            <p>This payslip predates persisting <span className="mono">tax_bands</span> — reseed to regenerate it.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Band</th><th>Rate</th><th>Taxable in band</th><th>Tax</th></tr>
              </thead>
              <tbody>
                {slip.tax_bands.map((band, i) => (
                  <tr key={i}>
                    <td className="mono">{money(band.fromSantim)} – {band.toSantim === null ? '∞' : money(band.toSantim)}</td>
                    <td className="mono">{pct(band.rate)}</td>
                    <td className="mono">{money(band.taxableInBandSantim)}</td>
                    <td className="mono">{money(band.taxSantim)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontWeight: 600 }}>PAYE total</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{money(slip.paye_santim)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="detail-grid">
        <div className="detail-field">
          <div className="detail-field__label">Basic salary</div>
          <div className="detail-field__value mono">{money(slip.basic_salary_santim)}</div>
        </div>
        <div className="detail-field">
          <div className="detail-field__label">Employer pension (11%)</div>
          <div className="detail-field__value mono">{money(slip.employer_pension_santim)}</div>
        </div>
        <div className="detail-field">
          <div className="detail-field__label">Employer cost</div>
          <div className="detail-field__value mono">{money(slip.employer_cost_santim)}</div>
        </div>
      </div>
    </main>
  );
}
