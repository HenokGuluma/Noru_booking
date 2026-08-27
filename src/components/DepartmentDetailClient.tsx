'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocalOverlay } from '../lib/local-store';
import type { DepartmentRecord } from '../lib/records';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { DepartmentForm } from './DepartmentForm';

export interface DepartmentEmployee {
  id: string;
  givenName: string;
  fathersName: string;
  employeeNo: string;
  status: string;
}

export function DepartmentDetailClient({
  id,
  serverRecord,
  employees,
}: {
  id: string;
  serverRecord: DepartmentRecord | null;
  employees: DepartmentEmployee[];
}) {
  const router = useRouter();
  const { rows, updateRow, deleteRow, isLocal } = useLocalOverlay<DepartmentRecord>('departments', serverRecord ? [serverRecord] : []);
  const record = rows.find((r) => r.id === id);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!record) {
    return (
      <main className="page">
        <section className="card">
          <div className="empty">
            <Icon name="grid" size={30} />
            <h4>Department not found</h4>
            <p>
              It may have been removed in this session, or the link is stale.{' '}
              <Link href="/departments" style={{ color: 'var(--enamel)' }}>Back to departments</Link>.
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
        <Link href="/departments" className="mono muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12.5 }}>
          <Icon name="chevronLeft" size={13} />
          Departments
        </Link>
      </p>

      <div className="detail-head">
        <span className="detail-avatar" aria-hidden="true">{record.code.slice(0, 3)}</span>
        <div>
          <div className="detail-head__name">{record.name}</div>
          <div className="detail-head__meta">
            {record.nameAm && <span>{record.nameAm}</span>}
            <span className={`pill ${record.isOperational ? 'pill--success' : 'pill--indigo'}`}>
              <span className="pill__dot" />
              {record.isOperational ? 'operational' : 'back office'}
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
          <span>This department was added locally in this browser session — there&rsquo;s no database row behind it.</span>
        </div>
      )}

      <div className="detail-grid">
        <Field label="Code" value={record.code} mono />
        <Field label="Position" value={record.positionTitle ?? '—'} />
        <Field label="Headcount" value={String(record.headcount)} mono />
      </div>

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">Staff in this department</h2>
          <span className="card__note mono">{employees.length}</span>
        </header>
        {employees.length === 0 ? (
          <div className="empty">
            <Icon name="users" size={28} />
            <h4>No staff assigned</h4>
            <p>{local ? 'Locally-added departments have no staff yet.' : 'Nobody is currently assigned here.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>No.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <Link href={`/staff/${emp.id}`} className="col-name" style={{ textDecoration: 'none', color: 'inherit' }}>
                        {emp.givenName} {emp.fathersName}
                      </Link>
                    </td>
                    <td className="mono muted">{emp.employeeNo}</td>
                    <td className="muted">{emp.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <Modal title="Edit department" onClose={() => setEditing(false)}>
          <DepartmentForm
            initial={record}
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
          title="Remove department"
          onClose={() => setConfirmingDelete(false)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  deleteRow(record.id);
                  router.push('/departments');
                }}
              >
                Remove
              </button>
            </>
          }
        >
          <p>Remove <strong>{record.name}</strong> from this session&rsquo;s view?</p>
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
