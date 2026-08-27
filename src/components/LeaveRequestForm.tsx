'use client';

import { useState, type FormEvent } from 'react';
import type { EmployeeOption } from '../lib/records';

export interface LeaveTypeOption {
  id: string;
  name: string;
}

export function LeaveRequestForm({
  employees,
  leaveTypes,
  onSubmit,
  onCancel,
}: {
  employees: EmployeeOption[];
  leaveTypes: LeaveTypeOption[];
  onSubmit: (values: { employeeId: string; employeeName: string; leaveTypeId: string; leaveTypeName: string; startsOn: string; endsOn: string; reason: string }) => void;
  onCancel: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? '');
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const employee = employees.find((e) => e.id === employeeId);
    const leaveType = leaveTypes.find((t) => t.id === leaveTypeId);
    if (!employee || !leaveType) {
      setError('Choose an employee and a leave type.');
      return;
    }
    if (endsOn < startsOn) {
      setError('End date must be on or after the start date.');
      return;
    }
    onSubmit({
      employeeId: employee.id,
      employeeName: employee.name,
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      startsOn,
      endsOn,
      reason: reason.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="banner banner--error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="field">
        <label htmlFor="leaveEmployee">Employee</label>
        <select id="leaveEmployee" className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name} · {e.employeeNo}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="leaveType">Leave type</label>
        <select id="leaveType" className="input" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
          {leaveTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="startsOn">Starts on</label>
          <input id="startsOn" className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="endsOn">Ends on</label>
          <input id="endsOn" className="input" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="reason">Reason</label>
        <textarea id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
      </div>

      <div className="modal__foot" style={{ padding: '14px 0 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary">Submit request</button>
      </div>
    </form>
  );
}
