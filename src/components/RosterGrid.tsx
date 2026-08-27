'use client';

import { useState } from 'react';
import { useLocalOverlay, localId } from '../lib/local-store';
import type { ShiftAssignmentEntry, ShiftTemplateOption } from '../lib/records';
import { Icon } from './Icon';
import { Modal } from './Modal';

interface EmployeeRow {
  id: string;
  name: string;
  departmentName: string;
}

interface RosterStatus {
  id: string;
  department_name: string;
  status: string;
}

function fmt(minutes: number): string {
  const m = minutes % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function RosterGrid({
  weekStart,
  initialAssignments,
  employees,
  shiftTemplates,
  initialRosterStatuses,
}: {
  weekStart: string;
  initialAssignments: ShiftAssignmentEntry[];
  employees: EmployeeRow[];
  shiftTemplates: ShiftTemplateOption[];
  initialRosterStatuses: RosterStatus[];
}) {
  const { rows: assignments, addRow, updateRow, deleteRow } = useLocalOverlay<ShiftAssignmentEntry>('roster-assignments', initialAssignments);
  const { rows: rosterStatuses, updateRow: updateStatus } = useLocalOverlay<RosterStatus>('roster-status', initialRosterStatuses);

  const [cell, setCell] = useState<{ employeeId: string; employeeName: string; workDate: string; existing: ShiftAssignmentEntry | null } | null>(null);
  const [pickedShiftId, setPickedShiftId] = useState('');

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const byCell = new Map<string, ShiftAssignmentEntry>();
  for (const a of assignments) byCell.set(`${a.employeeId}|${a.workDate}`, a);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}>Publish status:</span>
          {rosterStatuses.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`pill ${r.status === 'published' ? 'pill--success' : 'pill--muted'}`}
              style={{ border: 'none', cursor: 'pointer' }}
              onClick={() => updateStatus(r.id, { status: r.status === 'published' ? 'draft' : 'published' })}
              title="Click to toggle (local only)"
            >
              <span className="pill__dot" />
              {r.department_name}: {r.status}
            </button>
          ))}
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Dept.</th>
                {days.map((day) => (
                  <th key={day}>{new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="col-name" style={{ whiteSpace: 'nowrap' }}>{employee.name}</td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{employee.departmentName}</td>
                  {days.map((day) => {
                    const assignment = byCell.get(`${employee.id}|${day}`);
                    return (
                      <td key={day}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                          onClick={() => setCell({ employeeId: employee.id, employeeName: employee.name, workDate: day, existing: assignment ?? null })}
                        >
                          {assignment ? (
                            <span className="shift-chip">
                              <span className="shift-chip__dot" style={{ background: assignment.shiftColour }} />
                              {assignment.shiftCode} {fmt(assignment.startMinutes)}–{fmt(assignment.endMinutes)}
                            </span>
                          ) : (
                            <span className="shift-chip shift-chip--rest">rest</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {cell && (
        <Modal
          title={cell.existing ? `Edit shift — ${cell.employeeName}` : `Assign shift — ${cell.employeeName}`}
          onClose={() => {
            setCell(null);
            setPickedShiftId('');
          }}
          footer={
            <>
              {cell.existing && (
                <button
                  type="button"
                  className="btn btn--danger"
                  style={{ marginRight: 'auto' }}
                  onClick={() => {
                    deleteRow(cell.existing!.id);
                    setCell(null);
                    setPickedShiftId('');
                  }}
                >
                  Remove (rest day)
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setCell(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!pickedShiftId}
                onClick={() => {
                  const template = shiftTemplates.find((t) => t.id === pickedShiftId);
                  if (!template) return;
                  if (cell.existing) {
                    updateRow(cell.existing.id, {
                      shiftTemplateId: template.id,
                      shiftCode: template.code,
                      shiftColour: template.colour,
                      startMinutes: template.startMinutes,
                      endMinutes: template.endMinutes,
                    });
                  } else {
                    addRow({
                      id: localId(),
                      employeeId: cell.employeeId,
                      employeeName: cell.employeeName,
                      departmentName: employees.find((e) => e.id === cell.employeeId)?.departmentName ?? '',
                      workDate: cell.workDate,
                      shiftTemplateId: template.id,
                      shiftCode: template.code,
                      shiftColour: template.colour,
                      startMinutes: template.startMinutes,
                      endMinutes: template.endMinutes,
                    });
                  }
                  setCell(null);
                  setPickedShiftId('');
                }}
              >
                {cell.existing ? 'Change shift' : 'Assign'}
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="shiftPick">Shift</label>
            <select id="shiftPick" className="input" value={pickedShiftId} onChange={(e) => setPickedShiftId(e.target.value)}>
              <option value="">Choose a shift…</option>
              {shiftTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.code}) · {fmt(t.startMinutes)}–{fmt(t.endMinutes)}</option>
              ))}
            </select>
          </div>
          <div className="local-note">
            <Icon name="info" size={15} />
            <span>Local only — changes here don&rsquo;t write to the roster in the database.</span>
          </div>
        </Modal>
      )}
    </>
  );
}
