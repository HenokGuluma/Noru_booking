'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocalOverlay, localId } from '../lib/local-store';
import type { EmployeeRecord, DepartmentOption } from '../lib/records';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { EmployeeForm } from './EmployeeForm';

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

export function StaffTable({
  initialStaff,
  departments,
}: {
  initialStaff: EmployeeRecord[];
  departments: DepartmentOption[];
}) {
  const { rows, addRow, updateRow, deleteRow, isLocal } = useLocalOverlay<EmployeeRecord>('staff', initialStaff);
  const [modal, setModal] = useState<'add' | { editId: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EmployeeRecord | null>(null);

  const editing = modal && modal !== 'add' ? rows.find((r) => r.id === modal.editId) : null;

  const departmentCount = new Set(rows.map((s) => s.departmentName)).size;
  const activeCount = rows.filter((s) => s.status === 'active').length;
  const probationCount = rows.filter((s) => s.status === 'probation').length;

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon"><Icon name="users" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Total staff</span>
            <div className="kpi__value">{rows.length}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="grid" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Departments</span>
            <div className="kpi__value">{departmentCount}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Active</span>
            <div className="kpi__value">{activeCount}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ochre"><Icon name="clock" /></span>
          <div className="kpi__body">
            <span className="kpi__label">On probation</span>
            <div className="kpi__value">{probationCount}</div>
          </div>
        </div>
      </div>

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">All staff</h2>
          <button type="button" className="btn btn--primary btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setModal('add')}>
            <Icon name="plus" size={14} />
            Add employee
          </button>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>No.</th>
                <th>Department</th>
                <th>Position</th>
                <th>Status</th>
                <th>Years</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((person) => (
                <tr key={person.id}>
                  <td>
                    <Link href={`/staff/${person.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
                      <span
                        className="mono"
                        style={{
                          width: 28, height: 28, borderRadius: 8, background: 'var(--enamel-tint)', color: 'var(--enamel-deep)',
                          display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0,
                        }}
                      >
                        {initials(person.givenName, person.fathersName)}
                      </span>
                      <span className="col-name">{person.givenName} {person.fathersName}</span>
                      {isLocal(person.id) && <span className="pill local-pill" style={{ fontSize: 10 }}>local</span>}
                    </Link>
                  </td>
                  <td className="mono muted">{person.employeeNo}</td>
                  <td>{person.departmentName}</td>
                  <td className="muted">{person.positionTitle}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[person.status] ?? 'pill--muted'}`}>
                      <span className="pill__dot" />
                      {person.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="mono">{person.yearsOfService ?? '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="icon-btn" title="Edit" onClick={() => setModal({ editId: person.id })}>
                        <Icon name="pencil" size={14} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" title="Delete" onClick={() => setPendingDelete(person)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(modal === 'add' || editing) && (
        <Modal title={editing ? 'Edit employee' : 'Add employee'} onClose={() => setModal(null)}>
          <EmployeeForm
            initial={editing ?? {}}
            departments={departments}
            onCancel={() => setModal(null)}
            onSubmit={(values) => {
              if (editing) {
                updateRow(editing.id, values);
              } else {
                addRow({ id: localId(), employeeNo: 'LOCAL', yearsOfService: 0, ...values });
              }
              setModal(null);
            }}
          />
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          title="Remove employee"
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  deleteRow(pendingDelete.id);
                  setPendingDelete(null);
                }}
              >
                Remove
              </button>
            </>
          }
        >
          <p>
            Remove <strong>{pendingDelete.givenName} {pendingDelete.fathersName}</strong> from this session&rsquo;s view?
          </p>
          <div className="local-note" style={{ marginTop: 14 }}>
            <Icon name="info" size={15} />
            <span>Local only — this doesn&rsquo;t delete the record from the database, and reverts if you clear this browser&rsquo;s storage.</span>
          </div>
        </Modal>
      )}
    </>
  );
}
