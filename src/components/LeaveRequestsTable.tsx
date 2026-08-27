'use client';

import { useState } from 'react';
import { useLocalOverlay, localId } from '../lib/local-store';
import type { LeaveRequestEntry, EmployeeOption } from '../lib/records';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { LeaveRequestForm, type LeaveTypeOption } from './LeaveRequestForm';

const STATUS_PILL: Record<string, string> = {
  pending: 'pill--warning',
  approved: 'pill--success',
  taken: 'pill--success',
  rejected: 'pill--danger',
  cancelled: 'pill--muted',
  draft: 'pill--muted',
};

export function LeaveRequestsTable({
  initialRequests,
  employees,
  leaveTypes,
}: {
  initialRequests: LeaveRequestEntry[];
  employees: EmployeeOption[];
  leaveTypes: LeaveTypeOption[];
}) {
  const { rows, addRow, updateRow, isLocal } = useLocalOverlay<LeaveRequestEntry>('leave-requests', initialRequests);
  const [adding, setAdding] = useState(false);

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <>
      <section className="card">
        <header className="card__head">
          <h2 className="card__title">Requests</h2>
          <span className="card__note mono">{pendingCount} pending</span>
          <button type="button" className="btn btn--primary btn--sm" style={{ marginLeft: 12 }} onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} />
            New request
          </button>
        </header>
        {rows.length === 0 ? (
          <div className="empty">
            <Icon name="umbrella" size={30} />
            <h4>No requests yet</h4>
            <p>Run <span className="mono">pnpm seed</span> against a fresh database to generate some, or add one above.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <tr key={request.id}>
                    <td className="col-name">
                      {request.employeeName}
                      {isLocal(request.id) && <span className="pill local-pill" style={{ fontSize: 10, marginLeft: 6 }}>local</span>}
                    </td>
                    <td className="muted">{request.leaveTypeName}</td>
                    <td className="mono">{request.startsOn} – {request.endsOn}</td>
                    <td className="muted" style={{ maxWidth: 220 }}>
                      {request.reason}
                      {request.decisionNote && <div style={{ fontSize: 11, marginTop: 2 }}>Note: {request.decisionNote}</div>}
                    </td>
                    <td>
                      <span className={`pill ${STATUS_PILL[request.status] ?? 'pill--muted'}`}>
                        <span className="pill__dot" />
                        {request.status}
                      </span>
                    </td>
                    <td>
                      {request.status === 'pending' && (
                        <div className="row-actions">
                          <button type="button" className="mini" onClick={() => updateRow(request.id, { status: 'rejected' })}>
                            Decline
                          </button>
                          <button type="button" className="mini mini--ok" onClick={() => updateRow(request.id, { status: 'approved' })}>
                            Approve
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adding && (
        <Modal title="New leave request" onClose={() => setAdding(false)}>
          <LeaveRequestForm
            employees={employees}
            leaveTypes={leaveTypes}
            onCancel={() => setAdding(false)}
            onSubmit={(values) => {
              addRow({
                id: localId(),
                employeeId: values.employeeId,
                employeeName: values.employeeName,
                leaveTypeName: values.leaveTypeName,
                startsOn: values.startsOn,
                endsOn: values.endsOn,
                workingDays: '—',
                status: 'pending',
                reason: values.reason || null,
              });
              setAdding(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}
