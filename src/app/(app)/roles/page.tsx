import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID } from '../../../lib/demo';
import { Icon } from '../../../components/Icon';

export const dynamic = 'force-dynamic';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  name_am: string | null;
  description: string | null;
  is_system: boolean;
  permission_count: number;
  permissions: string[];
}

export default async function RolesPage() {
  const roles = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<RoleRow[]>`
      SELECT r.id, r.code, r.name, r.name_am, r.description, r.is_system,
             COUNT(rp.permission_code)::int AS permission_count,
             array_agg(rp.permission_code ORDER BY rp.permission_code) AS permissions
      FROM iam.roles r
      LEFT JOIN iam.role_permissions rp ON rp.role_id = r.id
      GROUP BY r.id
      ORDER BY permission_count DESC`,
  );

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Access</span>
          <h1>Roles</h1>
          <p className="page__sub">Seven roles ship with the schema, scoped optionally to a property or department.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Roles</span>
            <div className="kpi__value">{roles.length}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="grid" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Permissions</span>
            <div className="kpi__value">
              {new Set(roles.flatMap((r) => r.permissions.filter(Boolean))).size}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {roles.map((role) => (
          <section className="card" key={role.id}>
            <header className="card__head">
              <div>
                <h2 className="card__title">{role.name}</h2>
                {role.name_am && <span className="muted" style={{ fontSize: 12 }}>{role.name_am}</span>}
              </div>
              <span className="card__note mono">{role.permission_count} perms</span>
            </header>
            <div className="card__body">
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{role.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {role.permission_count === roles[0]?.permission_count && role.is_system ? (
                  <span className="pill pill--indigo">
                    <span className="pill__dot" />
                    all permissions
                  </span>
                ) : (
                  role.permissions
                    .filter(Boolean)
                    .slice(0, 6)
                    .map((p) => (
                      <span className="pill pill--muted" key={p}>
                        {p}
                      </span>
                    ))
                )}
                {role.permission_count > 6 && role.permission_count !== roles[0]?.permission_count && (
                  <span className="pill pill--muted">+{role.permission_count - 6} more</span>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
