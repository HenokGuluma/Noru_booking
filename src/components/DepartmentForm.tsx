'use client';

import { useState, type FormEvent } from 'react';
import type { DepartmentRecord } from '../lib/records';

export function DepartmentForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Partial<DepartmentRecord>;
  onSubmit: (values: Omit<DepartmentRecord, 'id' | 'headcount'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [nameAm, setNameAm] = useState(initial.nameAm ?? '');
  const [code, setCode] = useState(initial.code ?? '');
  const [isOperational, setIsOperational] = useState(initial.isOperational ?? true);
  const [positionTitle, setPositionTitle] = useState(initial.positionTitle ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Name and code are required.');
      return;
    }
    onSubmit({
      name: name.trim(),
      nameAm: nameAm.trim() || null,
      code: code.trim().toUpperCase(),
      isOperational,
      positionTitle: positionTitle.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="banner banner--error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="field-row">
        <div className="field">
          <label htmlFor="deptName">Name</label>
          <input id="deptName" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="deptCode">Code</label>
          <input id="deptCode" className="input mono" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required />
        </div>
      </div>

      <div className="field">
        <label htmlFor="deptNameAm">Name (Amharic)</label>
        <input id="deptNameAm" className="input" value={nameAm} onChange={(e) => setNameAm(e.target.value)} lang="am" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="deptPosition">Primary position</label>
          <input id="deptPosition" className="input" value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} placeholder="e.g. Front Office Associate" />
        </div>
        <div className="field">
          <label htmlFor="deptType">Type</label>
          <select id="deptType" className="input" value={isOperational ? 'operational' : 'back_office'} onChange={(e) => setIsOperational(e.target.value === 'operational')}>
            <option value="operational">Operational</option>
            <option value="back_office">Back office</option>
          </select>
        </div>
      </div>

      <div className="modal__foot" style={{ padding: '14px 0 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary">Save</button>
      </div>
    </form>
  );
}
