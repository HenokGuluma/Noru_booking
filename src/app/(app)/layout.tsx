import { withScope } from '../../lib/db/scope';
import { DEMO_ADMIN_USER_ID } from '../../lib/demo';
import { PreferenceProvider } from '../../lib/preferences';
import { AppShell } from '../../components/AppShell';
import { Icon } from '../../components/Icon';

const NAV = [
  {
    group: ['Operate', 'ስራ አስኪያጅ'] as [string, string],
    items: [
      { href: '/', label: ['Duty desk', 'የተረኛ ዴስክ'] as [string, string], icon: <Icon name="grid" /> },
      { href: '/roster', label: ['Roster', 'ፕሮግራም'] as [string, string], icon: <Icon name="calendar" /> },
      { href: '/attendance', label: ['Attendance', 'መገኘት'] as [string, string], icon: <Icon name="clock" /> },
    ],
  },
  {
    group: ['People', 'ሰዎች'] as [string, string],
    items: [
      { href: '/staff', label: ['Staff', 'ሠራተኞች'] as [string, string], icon: <Icon name="users" /> },
      { href: '/departments', label: ['Departments', 'ክፍሎች'] as [string, string], icon: <Icon name="grid" /> },
      { href: '/leave', label: ['Leave', 'ፈቃድ'] as [string, string], icon: <Icon name="umbrella" /> },
    ],
  },
  {
    group: ['Money', 'ገንዘብ'] as [string, string],
    items: [{ href: '/payroll', label: ['Payroll', 'ደመወዝ'] as [string, string], icon: <Icon name="banknote" /> }],
  },
  {
    group: ['Access', 'ፍቃድ'] as [string, string],
    items: [{ href: '/roles', label: ['Roles', 'ሚናዎች'] as [string, string], icon: <Icon name="scale" /> }],
  },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const properties = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<{ id: string; name: string; code: string }[]>`
      SELECT id, name, code FROM org.properties ORDER BY name`,
  );

  const activeProperty = properties[0] ?? { id: '', name: 'No property seeded', code: '—' };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PreferenceProvider>
      <AppShell
        properties={properties}
        activeProperty={activeProperty}
        today={today}
        nav={NAV}
        user={{ displayName: 'Selamawit Bekele', roleLabel: 'Group administrator', initials: 'SB' }}
      >
        {children}
      </AppShell>
    </PreferenceProvider>
  );
}
