'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocalOverlay } from '../lib/local-store';
import type { OnDutyEntry, EmployeeOption, LeaveRequestEntry } from '../lib/records';
import { TagBoard, type OnDuty } from './TagBoard';
import { Icon } from './Icon';
import { Modal } from './Modal';

interface CoverageRow {
  department_id: string;
  name: string;
  name_am: string | null;
  department_code: string;
  required: number;
}

function minutesOfDayAddisNow(): number {
  const now = new Date();
  return ((now.getUTCHours() + 3) * 60 + now.getUTCMinutes()) % 1440;
}

export function DutyDeskClient({
  initialOnDuty,
  employeeOptions,
  coverage,
  rosteredToday,
  initialPendingLeave,
}: {
  initialOnDuty: OnDutyEntry[];
  employeeOptions: EmployeeOption[];
  coverage: CoverageRow[];
  rosteredToday: number;
  initialPendingLeave: LeaveRequestEntry[];
}) {
  const { rows: onDuty, addRow, deleteRow } = useLocalOverlay<OnDutyEntry>('duty-log', initialOnDuty);
  const { rows: leaveRows, updateRow: updateLeave } = useLocalOverlay<LeaveRequestEntry>('leave-requests', initialPendingLeave);
  const pendingLeave = leaveRows.filter((r) => r.status === 'pending');

  const [clockInOpen, setClockInOpen] = useState(false);
  const [clockOutTarget, setClockOutTarget] = useState<OnDutyEntry | null>(null);
  const [pickedEmployeeId, setPickedEmployeeId] = useState('');

  const onDutyIds = new Set(onDuty.map((e) => e.id));
  const available = employeeOptions.filter((e) => !onDutyIds.has(e.id));

  const lateCount = onDuty.filter((e) => e.isLate).length;

  const onDutyCountByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of onDuty) map.set(entry.departmentCode, (map.get(entry.departmentCode) ?? 0) + 1);
    return map;
  }, [onDuty]);

  const liveCoverage = coverage.map((dept) => ({
    ...dept,
    onDuty: onDutyCountByCode.get(dept.department_code) ?? 0,
  }));
  const shortCount = liveCoverage.filter((d) => d.required > 0 && d.onDuty < d.required).length;

  const tagBoardData: OnDuty[] = onDuty.map((entry) => ({
    employeeId: entry.id,
    employeeNumber: entry.employeeNumber,
    shortName: entry.shortName,
    amharicName: entry.amharicName,
    departmentCode: entry.departmentCode,
    departmentColour: entry.departmentColour,
    clockedInMinutes: entry.clockedInMinutes,
    isLate: entry.isLate,
  }));

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon"><Icon name="grid" /></span>
          <div className="kpi__body">
            <span className="kpi__label">On duty now</span>
            <div className="kpi__value">{onDuty.length}</div>
            <div className="kpi__delta">of {rosteredToday} rostered today</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ochre"><Icon name="clock" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Late</span>
            <div className="kpi__value">{lateCount}</div>
            <div className="kpi__delta">clocked in past shift start</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ember"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Short-staffed</span>
            <div className="kpi__value">{shortCount}</div>
            <div className="kpi__delta">of {coverage.length} departments</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="calendar" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Rostered today</span>
            <div className="kpi__value">{rosteredToday}</div>
            <div className="kpi__delta">shift assignments</div>
          </div>
        </div>
      </div>

      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 0' }}>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setClockInOpen(true)}>
            <Icon name="plus" size={14} />
            Clock in
          </button>
          <span className="muted" style={{ fontSize: 12 }}>Click a tag below to clock someone out.</span>
        </div>
        <div style={{ padding: 18 }}>
          <TagBoard onDuty={tagBoardData} rosteredCount={rosteredToday} onSelect={(id) => setClockOutTarget(onDuty.find((e) => e.id === id) ?? null)} />
        </div>
      </section>

      <div className="desk__grid">
        <section className="card">
          <header className="card__head">
            <h2 className="card__title">Cover by department</h2>
          </header>
          <div className="card__body">
            <ul className="cov">
              {liveCoverage.map((department) => {
                const short = department.onDuty < department.required;
                const tight = department.onDuty === department.required && department.required > 0;
                const pct = department.required > 0 ? (department.onDuty / department.required) * 100 : 100;
                return (
                  <li className="cov__row" key={department.department_id}>
                    <span className="cov__name">{department.name}</span>
                    <span
                      className="cov__track"
                      role="meter"
                      aria-valuenow={department.onDuty}
                      aria-valuemin={0}
                      aria-valuemax={department.required}
                      aria-label={`${department.name}: ${department.onDuty} of ${department.required}`}
                    >
                      <span
                        className={`cov__fill${short ? ' cov__fill--short' : tight ? ' cov__fill--tight' : ''}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </span>
                    <span className={`cov__n mono${short ? ' cov__n--short' : ''}`}>
                      {department.onDuty}/{department.required}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="card">
          <header className="card__head">
            <h2 className="card__title">Waiting on you</h2>
            <span className="card__note mono">{pendingLeave.length}</span>
          </header>
          {pendingLeave.length === 0 ? (
            <div className="empty">
              <Icon name="tag" size={30} />
              <h4>Nothing waiting</h4>
              <p>No pending leave requests right now.</p>
            </div>
          ) : (
            <ul className="queue">
              {pendingLeave.map((request) => (
                <li className="queue__item" key={request.id}>
                  <span className="queue__avatar" aria-hidden="true">
                    {request.employeeName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <span className="queue__main">
                    <span className="queue__title">{request.employeeName} · {request.leaveTypeName}</span>
                    <span className="queue__meta mono">
                      {request.startsOn} – {request.endsOn} · {request.workingDays}d
                    </span>
                  </span>
                  <span className="queue__actions">
                    <button type="button" className="mini" onClick={() => updateLeave(request.id, { status: 'rejected' })}>
                      Decline
                    </button>
                    <button type="button" className="mini mini--ok" onClick={() => updateLeave(request.id, { status: 'approved' })}>
                      Approve
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="card__body" style={{ paddingTop: 0 }}>
            <Link href="/leave" className="mono muted" style={{ fontSize: 11.5 }}>See all leave →</Link>
          </div>
        </section>
      </div>

      {clockInOpen && (
        <Modal
          title="Clock in"
          onClose={() => setClockInOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setClockInOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!pickedEmployeeId}
                onClick={() => {
                  const employee = available.find((e) => e.id === pickedEmployeeId);
                  if (!employee) return;
                  addRow({
                    id: employee.id,
                    employeeNumber: employee.employeeNo,
                    shortName: employee.name,
                    amharicName: employee.name,
                    departmentCode: employee.departmentCode,
                    departmentColour: employee.departmentColour,
                    clockedInMinutes: minutesOfDayAddisNow(),
                    isLate: false,
                  });
                  setPickedEmployeeId('');
                  setClockInOpen(false);
                }}
              >
                Clock in
              </button>
            </>
          }
        >
          {available.length === 0 ? (
            <p className="muted">Everyone is already on duty.</p>
          ) : (
            <div className="field">
              <label htmlFor="clockInEmployee">Employee</label>
              <select id="clockInEmployee" className="input" value={pickedEmployeeId} onChange={(e) => setPickedEmployeeId(e.target.value)}>
                <option value="">Choose an employee…</option>
                {available.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} · {e.employeeNo}</option>
                ))}
              </select>
            </div>
          )}
          <div className="local-note" style={{ marginTop: 14 }}>
            <Icon name="info" size={15} />
            <span>Local only — records a punch in this session&rsquo;s view, not in the database.</span>
          </div>
        </Modal>
      )}

      {clockOutTarget && (
        <Modal
          title="Clock out"
          onClose={() => setClockOutTarget(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setClockOutTarget(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  deleteRow(clockOutTarget.id);
                  setClockOutTarget(null);
                }}
              >
                Clock out
              </button>
            </>
          }
        >
          <p>Clock out <strong>{clockOutTarget.shortName}</strong> ({clockOutTarget.employeeNumber})?</p>
        </Modal>
      )}
    </>
  );
}
