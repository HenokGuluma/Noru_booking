'use client';

import { useState } from 'react';
import { buildPayslip, summariseRun, formatBirr, type Santim } from '../lib/domain';
import { Icon } from './Icon';

interface EmployeeSalary {
  id: string;
  name: string;
  basicSalarySantim: Santim;
}

export function StartRunCard({
  periodLabel,
  periodEnd,
  openDaysCount,
  hasAnyAttendance,
  ruleSetId,
  employees,
}: {
  periodLabel: string;
  periodEnd: string;
  openDaysCount: number;
  hasAnyAttendance: boolean;
  ruleSetId: string;
  employees: EmployeeSalary[];
}) {
  const [preview, setPreview] = useState<ReturnType<typeof summariseRun> | null>(null);
  const blocked = openDaysCount > 0 || !hasAnyAttendance;

  return (
    <section className="card">
      <header className="card__head">
        <h2 className="card__title">Start a run for {periodLabel}</h2>
      </header>
      <div className="card__body">
        {blocked ? (
          <div className="banner banner--error">
            {openDaysCount > 0
              ? `${openDaysCount} attendance day(s) in this period are still open. Close attendance before calculating payroll.`
              : `No attendance recorded yet for ${periodLabel}.`}
          </div>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Attendance for {periodLabel} is fully locked. Rule set <span className="mono">{ruleSetId}</span> covers{' '}
              <span className="mono">{periodEnd}</span> — {employees.length} employees would be calculated.
            </p>
            {!preview ? (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  const slips = employees.map((e) =>
                    buildPayslip({ employeeId: e.id, periodEnd, basicSalarySantim: e.basicSalarySantim }),
                  );
                  setPreview(summariseRun(slips));
                }}
              >
                Preview calculation
              </button>
            ) : (
              <div className="detail-grid">
                <div className="detail-field">
                  <div className="detail-field__label">Gross</div>
                  <div className="detail-field__value mono">{formatBirr(preview.grossSantim)}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-field__label">Net pay</div>
                  <div className="detail-field__value mono">{formatBirr(preview.netPaySantim)}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-field__label">Headcount</div>
                  <div className="detail-field__value mono">{preview.headcount}</div>
                </div>
              </div>
            )}
            <div className="local-note" style={{ marginTop: 14 }}>
              <Icon name="info" size={15} />
              <span>
                Computed live with the real <span className="mono">buildPayslip</span> engine — not saved. Persisting
                a new run needs a Server Action that writes <span className="mono">payroll.runs</span> and{' '}
                <span className="mono">payroll.payslips</span> inside a scoped, audited transaction, which isn&rsquo;t
                wired up yet.
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
