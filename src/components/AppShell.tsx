'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePreferences } from '../lib/preferences';
import { formatWorkDate } from '../lib/format';
import './app-shell.css';

/**
 * The shell.
 *
 * Two things here are deliberate and easy to undo by accident.
 *
 * First, the date block leads with the Ethiopian date and puts the Gregorian
 * one underneath in smaller type by default — the reverse of almost every
 * business system sold into this market, and the right way round for the
 * people using this one. The Ethiopian/international clock toggle swaps which
 * one leads (and switches the Gregorian date to international weekday/month
 * naming when it does) — but neither ever disappears, banks need the
 * Gregorian date and staff read the Ethiopian one.
 *
 * Second, the property switcher is always visible. Staff move between
 * properties, permissions are scoped per property, and a manager acting on the
 * wrong hotel's roster is a real and expensive mistake. Which building you are
 * looking at should never require checking.
 */

interface NavItem {
  href: string;
  label: [en: string, am: string];
  icon: ReactNode;
  badge?: number;
}

export function AppShell({
  children,
  properties,
  activeProperty,
  onSwitchProperty,
  today,
  nav,
  user,
}: {
  children: ReactNode;
  properties: Array<{ id: string; name: string; code: string }>;
  activeProperty: { id: string; name: string; code: string };
  /** Only one property is seeded so far; the switcher is wired but a no-op until a second exists. */
  onSwitchProperty?: (propertyId: string) => void;
  today: string;
  nav: Array<{ group: [string, string]; items: NavItem[] }>;
  user: { displayName: string; roleLabel: string; initials: string };
}) {
  const { t, locale, clock, setLocale, setClock } = usePreferences();
  const date = formatWorkDate(today, locale, clock);

  return (
    <div className="shell">
      <nav className="rail" aria-label={t('Main', 'ዋና')}>
        <div className="rail__brand">
          <span className="rail__mark" aria-hidden="true">NC</span>
          <span>
            <span className="rail__name">Noru Crew</span>
            <span className="rail__sub">Noru Booking</span>
          </span>
        </div>

        {nav.map((group) => (
          <div className="rail__group" key={group.group[0]}>
            <h2 className="rail__label">{t(group.group[0], group.group[1])}</h2>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        ))}

        <div className="rail__foot">
          <div className="rail__who">
            <span className="rail__avatar" aria-hidden="true">{user.initials}</span>
            <span>
              <span className="rail__who-name">{user.displayName}</span>
              <span className="rail__who-role">{user.roleLabel}</span>
            </span>
          </div>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <label className="prop">
            <span className="visually-hidden">{t('Property', 'ሆቴል')}</span>
            <span className="prop__dot" aria-hidden="true" />
            <select
              value={activeProperty.id}
              onChange={(event) => onSwitchProperty?.(event.target.value)}
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
            <span className="prop__code mono">{activeProperty.code}</span>
          </label>

          <p className="datestack">
            <span className="datestack__et">{date.primary}</span>
            <span className="datestack__greg mono">{date.secondary}</span>
          </p>

          <div className="topbar__right">
            <Segmented
              label={t('Clock', 'ሰዓት')}
              value={clock}
              options={[
                { value: 'ethiopian', label: 'ETH' },
                { value: 'international', label: 'INTL' },
              ]}
              onChange={setClock}
            />
            <Segmented
              label={t('Language', 'ቋንቋ')}
              value={locale}
              options={[
                { value: 'en-ET', label: 'EN' },
                { value: 'am-ET', label: 'አማ' },
              ]}
              onChange={setLocale}
            />
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const { t } = usePreferences();
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      className="rail__item"
      aria-current={isActive ? 'page' : undefined}
    >
      {item.icon}
      {t(item.label[0], item.label[1])}
      {item.badge ? (
        <span className="rail__badge mono">
          {item.badge}
          <span className="visually-hidden"> {t('waiting', 'በመጠባበቅ ላይ')}</span>
        </span>
      ) : null}
    </Link>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
