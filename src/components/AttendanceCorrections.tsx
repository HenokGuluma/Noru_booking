'use client';

import { useState, type FormEvent } from 'react';
import { useLocalOverlay, localId } from '../lib/local-store';
import { Icon } from './Icon';
import { Modal } from './Modal';

interface CorrectionEntry {
  id: string;
  workDate: string;
  correctedFirstIn: string;
  correctedLastOut: string;
  justification: string;
  loggedAt: string;
}

export function AttendanceCorrections({ employeeId, availableDates }: { employeeId: string; availableDates: string[] }) {
  const { rows, addRow } = useLocalOverlay<CorrectionEntry>(`attendance-corrections:${employeeId}`, []);
  const [open, setOpen] = useState(false);
  const [workDate, setWorkDate] = useState(availableDates[0] ?? new Date().toISOString().slice(0, 10));
  const [firstIn, setFirstIn] = useState('');
  const [lastOut, setLastOut] = useState('');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!justification.trim()) {
      setError('A justification is required — this is what makes a correction different from just editing the record.');
      return;
    }
    addRow({
      id: localId(),
      workDate,
      correctedFirstIn: firstIn,
      correctedLastOut: lastOut,
      justification: justification.trim(),
      loggedAt: new Date().toLocaleString('en-GB'),
    });
    setFirstIn('');
    setLastOut('');
    setJustification('');
    setError(null);
    setOpen(false);
  }

  return (
    <section className="card">
      <header className="card__head">
        <h2 className="card__title">Corrections</h2>
        <span className="card__note mono">{rows.length}</span>
        <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: 12 }} onClick={() => setOpen(true)}>
          <Icon name="plus" size={14} />
          Log a correction
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="empty">
          <Icon name="pencil" size={28} />
          <h4>No corrections logged</h4>
          <p>A correction here is a new, justified record — it never edits or replaces the original punch above.</p>
        </div>
      ) : (
        <ul className="queue">
          {rows.map((c) => (
            <li className="queue__item" key={c.id}>
              <span className="queue__main">
                <span className="queue__title">
                  {c.workDate} · in {c.correctedFirstIn || '—'} / out {c.correctedLastOut || '—'}
                </span>
                <span className="queue__meta">{c.justification}</span>
                <span className="queue__meta mono">logged {c.loggedAt}</span>
              </span>
              <span className="pill local-pill">local</span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Modal title="Log a correction" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="banner banner--error" style={{ marginBottom: 14 }}>{error}</div>}

            <div className="field">
              <label htmlFor="corrDate">Date</label>
              {availableDates.length > 0 ? (
                <select id="corrDate" className="input" value={workDate} onChange={(e) => setWorkDate(e.target.value)}>
                  {availableDates.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input id="corrDate" className="input" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              )}
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="corrIn">Corrected in</label>
                <input id="corrIn" className="input" type="time" value={firstIn} onChange={(e) => setFirstIn(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="corrOut">Corrected out</label>
                <input id="corrOut" className="input" type="time" value={lastOut} onChange={(e) => setLastOut(e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="corrReason">Justification</label>
              <textarea
                id="corrReason"
                className="input"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Required — e.g. biometric reader was down, confirmed with supervisor"
              />
            </div>

            <div className="local-note" style={{ marginBottom: 14 }}>
              <Icon name="info" size={15} />
              <span>
                Local only — a real correction would insert a new row into <span className="mono">ops.punches</span> with{' '}
                <span className="mono">corrects_punch_id</span> set, then re-reconcile the day. That reconciliation
                pipeline isn&rsquo;t built (BUILD-PROMPT step 8), so this stays session-local rather than pretending to write it.
              </span>
            </div>

            <div className="modal__foot" style={{ padding: '14px 0 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn--primary">Log correction</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
