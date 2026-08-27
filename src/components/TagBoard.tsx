'use client';

import { usePreferences } from '../lib/preferences';
import { formatTime } from '../lib/format';
import './tag-board.css';

/**
 * The tag board.
 *
 * Every hotel back-of-house has a rack of numbered tags by the staff entrance
 * that you flip when you come on shift. This is that rack. It is the one
 * element in the product allowed to be literal, and everything around it stays
 * quiet so it can carry the personality.
 *
 * It is also the fastest answer to the question a duty manager actually asks,
 * which is not "what is our attendance rate" but "who is in the building".
 */

export interface OnDuty {
  employeeId: string;
  employeeNumber: string;
  shortName: string;
  amharicName: string;
  departmentCode: string;
  departmentColour: string;
  clockedInMinutes: number;
  isLate: boolean;
}

export function TagBoard({
  onDuty,
  rosteredCount,
  onSelect,
}: {
  onDuty: OnDuty[];
  rosteredCount: number;
  onSelect?: (employeeId: string) => void;
}) {
  const { t, locale, clock } = usePreferences();
  const late = onDuty.filter((person) => person.isLate).length;

  return (
    <section className="tagboard" aria-labelledby="tagboard-heading">
      <header className="tagboard__head">
        <h2 className="tagboard__title" id="tagboard-heading">
          {t('On the floor', 'በሥራ ላይ')}
        </h2>
        <span className="tagboard__live">
          <i aria-hidden="true" />
          {t('Live', 'ቀጥታ')}
        </span>
        <p className="tagboard__count">
          {t(
            `${onDuty.length} of ${rosteredCount} rostered · ${late} late`,
            `${onDuty.length} ከ${rosteredCount} · ${late} የዘገዩ`,
          )}
        </p>
      </header>

      <div className="tagboard__rail">
        <ul className="tagboard__tags">
          {onDuty.map((person, index) => (
            <li key={person.employeeId} className="tag">
              <button
                type="button"
                className={`tag__body${person.isLate ? ' tag__body--late' : ''}`}
                style={{
                  // A small alternating tilt so these read as objects hanging on
                  // hooks rather than a row of cards. Nothing else tilts.
                  '--tilt': `${index % 2 ? 1.1 : -1.1}deg`,
                  '--dept': person.departmentColour,
                } as React.CSSProperties}
                onClick={() => onSelect?.(person.employeeId)}
              >
                <span className="tag__no">{person.employeeNumber}</span>
                <span className="tag__name">
                  {locale === 'am-ET' ? person.amharicName : person.shortName}
                </span>
                <span className="tag__in">
                  {person.isLate && <span aria-hidden="true">▲ </span>}
                  {formatTime(person.clockedInMinutes, clock, locale)}
                  {person.isLate && (
                    <span className="visually-hidden"> {t('(late)', '(የዘገየ)')}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
