'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocalOverlay, localId } from '../lib/local-store';
import type { DepartmentRecord } from '../lib/records';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { DepartmentForm } from './DepartmentForm';

export function DepartmentsTable({ initialDepartments }: { initialDepartments: DepartmentRecord[] }) {
  const { rows, addRow, updateRow, deleteRow, isLocal } = useLocalOverlay<DepartmentRecord>('departments', initialDepartments);
  const [modal, setModal] = useState<'add' | { editId: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DepartmentRecord | null>(null);

  const editing = modal && modal !== 'add' ? rows.find((r) => r.id === modal.editId) : null;
  const totalHeadcount = rows.reduce((sum, d) => sum + d.headcount, 0);
  const operational = rows.filter((d) => d.isOperational).length;

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon"><Icon name="grid" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Departments</span>
            <div className="kpi__value">{rows.length}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="users" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Total headcount</span>
            <div className="kpi__value">{totalHeadcount}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Operational</span>
            <div className="kpi__value">{operational}</div>
            <div className="kpi__delta">vs {rows.length - operational} back office</div>
          </div>
        </div>
      </div>

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">All departments</h2>
          <button type="button" className="btn btn--primary btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setModal('add')}>
            <Icon name="plus" size={14} />
            Add department
          </button>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Position</th>
                <th>Headcount</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((dept) => (
                <tr key={dept.id}>
                  <td>
                    <Link href={`/departments/${dept.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="col-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {dept.name}
                        {isLocal(dept.id) && <span className="pill local-pill" style={{ fontSize: 10 }}>local</span>}
                      </div>
                      {dept.nameAm && <div className="muted" style={{ fontSize: 11.5 }}>{dept.nameAm}</div>}
                    </Link>
                  </td>
                  <td className="mono muted">{dept.code}</td>
                  <td className="muted">{dept.positionTitle ?? '—'}</td>
                  <td className="mono">{dept.headcount}</td>
                  <td>
                    <span className={`pill ${dept.isOperational ? 'pill--success' : 'pill--indigo'}`}>
                      <span className="pill__dot" />
                      {dept.isOperational ? 'operational' : 'back office'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="icon-btn" title="Edit" onClick={() => setModal({ editId: dept.id })}>
                        <Icon name="pencil" size={14} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" title="Delete" onClick={() => setPendingDelete(dept)}>
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
        <Modal title={editing ? 'Edit department' : 'Add department'} onClose={() => setModal(null)}>
          <DepartmentForm
            initial={editing ?? {}}
            onCancel={() => setModal(null)}
            onSubmit={(values) => {
              if (editing) {
                updateRow(editing.id, values);
              } else {
                addRow({ id: localId(), headcount: 0, ...values });
              }
              setModal(null);
            }}
          />
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          title="Remove department"
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
          <p>Remove <strong>{pendingDelete.name}</strong> from this session&rsquo;s view?</p>
          <div className="local-note" style={{ marginTop: 14 }}>
            <Icon name="info" size={15} />
            <span>Local only — this doesn&rsquo;t delete the record from the database.</span>
          </div>
        </Modal>
      )}
    </>
  );
}
