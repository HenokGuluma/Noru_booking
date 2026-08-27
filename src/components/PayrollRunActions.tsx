'use client';

import { useState } from 'react';
import { useLocalOverlay } from '../lib/local-store';
import type { PayrollRunEntry, ApproverOption } from '../lib/records';
import { Icon } from './Icon';
import { Modal } from './Modal';

const STATUS_PILL: Record<string, string> = {
  draft: 'pill--muted',
  calculating: 'pill--warning',
  calculated: 'pill--indigo',
  approved: 'pill--success',
  paid: 'pill--success',
  cancelled: 'pill--danger',
};

export function PayrollRunActions({ initialRun, approvers }: { initialRun: PayrollRunEntry; approvers: ApproverOption[] }) {
  const { rows, updateRow } = useLocalOverlay<PayrollRunEntry>('payroll-runs', [initialRun]);
  const run = rows.find((r) => r.id === initialRun.id) ?? initialRun;
  const [approving, setApproving] = useState(false);
  const [approverId, setApproverId] = useState('');

  // The real constraint: payroll.runs' own CHECK (runs_four_eyes) forbids
  // approved_by = calculated_by. Enforced here too, not just in the database.
  const eligibleApprovers = approvers.filter((a) => a.id !== run.calculatedBy);

  return (
    <>
      <p className="page__sub" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className={`pill ${STATUS_PILL[run.status] ?? 'pill--muted'}`}>
          <span className="pill__dot" />
          {run.status}
        </span>
        <span>calculated by {run.calculatedByName}</span>
        {run.approvedByName && <span>· approved by {run.approvedByName}</span>}
        {run.paidAt && <span>· paid</span>}
      </p>

      <div className="detail-head__actions" style={{ marginBottom: 4 }}>
        {run.status === 'calculated' && (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setApproving(true)}>
            <Icon name="check" size={14} />
            Approve
          </button>
        )}
        {run.status === 'approved' && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => updateRow(run.id, { status: 'paid', paidAt: new Date().toISOString() })}
          >
            <Icon name="banknote" size={14} />
            Mark as paid
          </button>
        )}
      </div>

      {approving && (
        <Modal
          title="Approve payroll run"
          onClose={() => setApproving(false)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setApproving(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!approverId}
                onClick={() => {
                  const approver = approvers.find((a) => a.id === approverId);
                  if (!approver) return;
                  updateRow(run.id, {
                    status: 'approved',
                    approvedBy: approver.id,
                    approvedByName: approver.name,
                    approvedAt: new Date().toISOString(),
                  });
                  setApproving(false);
                  setApproverId('');
                }}
              >
                Approve
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="approver">Approve as</label>
            <select id="approver" className="input" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
              <option value="">Choose an approver…</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === run.calculatedBy}>
                  {a.name}{a.id === run.calculatedBy ? ' — calculated this run, cannot approve it' : ''}
                </option>
              ))}
            </select>
            {eligibleApprovers.length === 0 && (
              <p className="hint" style={{ color: 'var(--ember)' }}>
                No eligible approver exists — whoever calculated this run is the only user seeded.
              </p>
            )}
          </div>
          <div className="local-note">
            <Icon name="info" size={15} />
            <span>
              Four-eyes is real here, not just a UI label: <span className="mono">payroll.runs</span> has a{' '}
              <span className="mono">CHECK (approved_by &lt;&gt; calculated_by)</span> constraint, so the option above
              is disabled for the same reason the database would reject it. The status change itself is local only.
            </span>
          </div>
        </Modal>
      )}
    </>
  );
}
