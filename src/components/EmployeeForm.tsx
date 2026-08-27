'use client';

import { useState, type FormEvent } from 'react';
import type { EmployeeRecord, DepartmentOption } from '../lib/records';

export function EmployeeForm({
  initial,
  departments,
  onSubmit,
  onCancel,
}: {
  initial: Partial<EmployeeRecord>;
  departments: DepartmentOption[];
  onSubmit: (values: Omit<EmployeeRecord, 'id' | 'employeeNo' | 'yearsOfService'>) => void;
  onCancel: () => void;
}) {
  const [givenName, setGivenName] = useState(initial.givenName ?? '');
  const [fathersName, setFathersName] = useState(initial.fathersName ?? '');
  const [grandfathersName, setGrandfathersName] = useState(initial.grandfathersName ?? '');
  const [givenNameAm, setGivenNameAm] = useState(initial.givenNameAm ?? '');
  const [fathersNameAm, setFathersNameAm] = useState(initial.fathersNameAm ?? '');
  const [sex, setSex] = useState<'male' | 'female'>(initial.sex ?? 'female');
  const [phone, setPhone] = useState(initial.phone ?? '+251');
  const [status, setStatus] = useState(initial.status ?? 'active');
  const [departmentId, setDepartmentId] = useState(initial.departmentId ?? departments[0]?.id ?? '');
  const [positionTitle, setPositionTitle] = useState(initial.positionTitle ?? '');
  const [hiredOn, setHiredOn] = useState(initial.hiredOn ?? new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!givenName.trim() || !fathersName.trim()) {
      setError('Given name and father’s name are required.');
      return;
    }
    const department = departments.find((d) => d.id === departmentId);
    if (!department) {
      setError('Choose a department.');
      return;
    }
    onSubmit({
      givenName: givenName.trim(),
      fathersName: fathersName.trim(),
      grandfathersName: grandfathersName.trim() || null,
      givenNameAm: givenNameAm.trim() || null,
      fathersNameAm: fathersNameAm.trim() || null,
      sex,
      phone: phone.trim(),
      status,
      departmentId,
      departmentName: department.name,
      positionTitle: positionTitle.trim() || null,
      hiredOn,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="banner banner--error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="field-row">
        <div className="field">
          <label htmlFor="givenName">Given name</label>
          <input id="givenName" className="input" value={givenName} onChange={(e) => setGivenName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="fathersName">Father&rsquo;s name</label>
          <input id="fathersName" className="input" value={fathersName} onChange={(e) => setFathersName(e.target.value)} required />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="grandfathersName">Grandfather&rsquo;s name</label>
          <input id="grandfathersName" className="input" value={grandfathersName} onChange={(e) => setGrandfathersName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sex">Sex</label>
          <select id="sex" className="input" value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="givenNameAm">Given name (Amharic)</label>
          <input id="givenNameAm" className="input" value={givenNameAm} onChange={(e) => setGivenNameAm(e.target.value)} lang="am" />
        </div>
        <div className="field">
          <label htmlFor="fathersNameAm">Father&rsquo;s name (Amharic)</label>
          <input id="fathersNameAm" className="input" value={fathersNameAm} onChange={(e) => setFathersNameAm(e.target.value)} lang="am" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="department">Department</label>
          <select id="department" className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="positionTitle">Position</label>
          <input id="positionTitle" className="input" value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251911223344" />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="probation">Probation</option>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="suspended">Suspended</option>
            <option value="notice_period">Notice period</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="hiredOn">Hired on</label>
        <input id="hiredOn" className="input" type="date" value={hiredOn} onChange={(e) => setHiredOn(e.target.value)} />
      </div>

      <div className="modal__foot" style={{ padding: '14px 0 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary">Save</button>
      </div>
    </form>
  );
}
