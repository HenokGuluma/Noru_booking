/**
 * Ethiopian personal names.
 *
 * There is no family surname. A person is known by their given name, followed by
 * their father's given name and, in formal records, their grandfather's. Sorting
 * by "last name" would group unrelated people by their grandfathers, and a
 * `last_name` column would force clerks to mangle real names into a foreign
 * shape. So the model stores three distinct fields and sorts on the given name,
 * which is how every Ethiopian staff list, payroll sheet and ID card is ordered.
 */

export interface PersonName {
  givenName: string;
  fathersName: string;
  grandfathersName?: string | null;
  /** Optional Ethiopic-script rendering, entered by the employee. */
  givenNameAm?: string | null;
  fathersNameAm?: string | null;
  grandfathersNameAm?: string | null;
}

export type NameStyle = 'short' | 'full' | 'legal';

/**
 * - `short`  → "Selamawit Bekele"          (rosters, chat, badges)
 * - `full`   → "Selamawit Bekele Tadesse"  (employee record, contracts)
 * - `legal`  → "Selamawit Bekele Tadesse"  (payroll, MoR/POESSA filings; grandfather's name required)
 */
export function formatName(
  name: PersonName,
  style: NameStyle = 'short',
  script: 'latin' | 'ethiopic' = 'latin',
): string {
  const pick = (latin: string | null | undefined, ethiopic: string | null | undefined) =>
    (script === 'ethiopic' ? ethiopic || latin : latin) ?? '';

  const given = pick(name.givenName, name.givenNameAm);
  const father = pick(name.fathersName, name.fathersNameAm);
  const grandfather = pick(name.grandfathersName, name.grandfathersNameAm);

  if (style === 'short') return [given, father].filter(Boolean).join(' ');
  if (style === 'legal' && !grandfather) {
    throw new Error(
      'Legal name requires the grandfather\u2019s name; statutory filings will be rejected without it',
    );
  }
  return [given, father, grandfather].filter(Boolean).join(' ');
}

/** Initials for avatars: given + father's name, never "surname first". */
export function initials(name: PersonName): string {
  return `${name.givenName.charAt(0)}${name.fathersName.charAt(0)}`.toUpperCase();
}

/** Locale-aware sort key. Ethiopic sorts under 'am', Latin under 'en'. */
export function sortKey(name: PersonName, script: 'latin' | 'ethiopic' = 'latin'): string {
  return formatName(name, 'full', script).toLocaleLowerCase(script === 'ethiopic' ? 'am' : 'en');
}

const ET_PHONE = /^(?:\+251|0)(9\d{8}|7\d{8}|11\d{7}|[1-5]\d{8})$/;

/** Normalise Ethiopian phone numbers to E.164. Accepts 09…, +2519…, 2519…. */
export function normalisePhone(input: string): string {
  const cleaned = input.replace(/[\s\-()]/g, '').replace(/^251/, '+251');
  const match = ET_PHONE.exec(cleaned);
  if (!match) throw new RangeError(`"${input}" is not a valid Ethiopian phone number`);
  return `+251${match[1]}`;
}

/** Ethiopian TIN: ten digits, issued by the Ministry of Revenues. */
export function isValidTIN(tin: string): boolean {
  return /^\d{10}$/.test(tin.replace(/[\s-]/g, ''));
}
