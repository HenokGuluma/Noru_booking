'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocalOverlay } from '../lib/local-store';
import type { EmployeeRecord, DepartmentOption } from '../lib/records';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { EmployeeForm } from './EmployeeForm';

interface EmployeeExtra {
  personalEmail: string | null;
  region: string | null;
  city: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  managerName: string | null;
  attendanceDaysPresent: number;
  attendanceDaysLate: number;
  leaveEntitled: number;
  leaveTaken: number;
}

const STATUS_PILL: Record<string, string> = {
  active: 'pill--success',
  probation: 'pill--warning',
  on_leave: 'pill--indigo',
  suspended: 'pill--danger',
  notice_period: 'pill--danger',
  terminated: 'pill--muted',
};

function initials(given: string, father: string): string {
  return `${given[0] ?? ''}${father[0] ?? ''}`.toUpperCase();
}

export function EmployeeDetailClient({
  id,
  serverRecord,
  extra,
  departments,
}: {
  id: string;
  serverRecord: EmployeeRecord | null;
  extra: EmployeeExtra | null;
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const { rows, updateRow, deleteRow, isLocal } = useLocalOverlay<EmployeeRecord>('staff', serverRecord ? [serverRecord] : []);
  const record = rows.find((r) => r.id === id);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!record) {
    return (
      <main className="page">
        <section className="card">
          <div className="empty">
            <Icon name="users" size={30} />
            <h4>Employee not found</h4>
            <p>
              It may have been removed in this session, or the link is stale.{' '}
              <Link href="/staff" style={{ color: 'var(--enamel)' }}>Back to staff</Link>.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const local = isLocal(record.id);

  return (
    <main className="page">
      <p>
        <Link href="/staff" className="mono muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12.5 }}>
          <Icon name="chevronLeft" size={13} />
          Staff
        </Link>
      </p>

      <div className="detail-head">
        <span className="detail-avatar" aria-hidden="true">{initials(record.givenName, record.fathersName)}</span>
        <div>
          <div className="detail-head__name">
            {record.givenName} {record.fathersName}
            {record.grandfathersName ? ` ${record.grandfathersName}` : ''}
          </div>
          <div className="detail-head__meta">
            <span className="mono">{record.employeeNo}</span>
            <span className={`pill ${STATUS_PILL[record.status] ?? 'pill--muted'}`}>
              <span className="pill__dot" />
              {record.status.replace('_', ' ')}
            </span>
            {local && <span className="pill local-pill">local only</span>}
          </div>
        </div>
        <div className="detail-head__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
            <Icon name="pencil" size={14} />
            Edit
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirmingDelete(true)}>
            <Icon name="trash" size={14} />
            Remove
          </button>
        </div>
      </div>

      {local && (
        <div className="local-note">
          <Icon name="info" size={15} />
          <span>
            This employee was added locally in this browser session — there&rsquo;s no database row behind it, so
            attendance and leave history below won&rsquo;t apply.
          </span>
        </div>
      )}

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">Details</h2>
        </header>
        <div className="card__body">
          <div className="detail-grid">
            <Field label="Sex" value={record.sex} />
            <Field label="Phone" value={record.phone} mono />
            <Field label="Department" value={record.departmentName} />
            <Field label="Position" value={record.positionTitle ?? '—'} />
            <Field label="Hired on" value={record.hiredOn} mono />
            <Field label="Years of service" value={String(record.yearsOfService ?? '—')} mono />
            {extra?.managerName && <Field label="Manager" value={extra.managerName} />}
            {extra?.personalEmail && <Field label="Email" value={extra.personalEmail} mono />}
            {(extra?.city || extra?.region) && <Field label="Location" value={[extra?.city, extra?.region].filter(Boolean).join(', ')} />}
            {extra?.emergencyContactName && (
              <Field label="Emergency contact" value={`${extra.emergencyContactName}${extra.emergencyContactPhone ? ` · ${extra.emergencyContactPhone}` : ''}`} />
            )}
          </div>
        </div>
      </section>

      {extra && (
        <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <Link href={`/attendance/${record.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="kpi__icon"><Icon name="clock" /></span>
              <div>
                <div className="kpi__label">Attendance (locked period)</div>
                <div className="kpi__value" style={{ fontSize: 20 }}>
                  {extra.attendanceDaysPresent} <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>days present</span>
                </div>
                <div className="kpi__delta">{extra.attendanceDaysLate} late</div>
              </div>
            </div>
          </Link>
          <Link href="/leave" className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="kpi__icon kpi__icon--ochre"><Icon name="umbrella" /></span>
              <div>
                <div className="kpi__label">Leave balance</div>
                <div className="kpi__value" style={{ fontSize: 20 }}>
                  {extra.leaveEntitled - extra.leaveTaken} <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>days remaining</span>
                </div>
                <div className="kpi__delta">{extra.leaveTaken} of {extra.leaveEntitled} taken</div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {editing && (
        <Modal title="Edit employee" onClose={() => setEditing(false)}>
          <EmployeeForm
            initial={record}
            departments={departments}
            onCancel={() => setEditing(false)}
            onSubmit={(values) => {
              updateRow(record.id, values);
              setEditing(false);
            }}
          />
        </Modal>
      )}

      {confirmingDelete && (
        <Modal
          title="Remove employee"
          onClose={() => setConfirmingDelete(false)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  deleteRow(record.id);
                  router.push('/staff');
                }}
              >
                Remove
              </button>
            </>
          }
        >
          <p>Remove <strong>{record.givenName} {record.fathersName}</strong> from this session&rsquo;s view?</p>
          <div className="local-note" style={{ marginTop: 14 }}>
            <Icon name="info" size={15} />
            <span>Local only — this doesn&rsquo;t delete the record from the database.</span>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-field">
      <div className="detail-field__label">{label}</div>
      <div className={`detail-field__value${mono ? ' mono' : ''}`}>{value}</div>
    </div>
  );
}
