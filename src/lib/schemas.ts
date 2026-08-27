import { z } from 'zod';

/**
 * The wire contract.
 *
 * Defined once and imported by both the Fastify routes (which validate against
 * it) and the React client (which infers its types from it). A field cannot
 * drift between the two, because there is only one of it.
 */

// --- primitives --------------------------------------------------------------

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const isoDateTime = z.string().datetime({ offset: true });

/** Ethiopian mobile and landline numbers, normalised to E.164 before storage. */
export const ethiopianPhone = z
  .string()
  .transform((value) => value.replace(/[\s\-()]/g, '').replace(/^0/, '+251').replace(/^251/, '+251'))
  .pipe(z.string().regex(/^\+251[0-9]{9}$/, 'Expected an Ethiopian number, e.g. 0911 22 33 44'));

export const tin = z.string().regex(/^\d{10}$/, 'A TIN is exactly ten digits');

/** Money crosses the wire as an integer count of santim. See packages/core/money.ts. */
export const santim = z.number().int().nonnegative();

export const locale = z.enum(['en-ET', 'am-ET']);
export const sex = z.enum(['female', 'male']);

export const minutesOfDay = z.number().int().min(0).max(1439);
/** May run past midnight: the 22:00-06:00 night shift ends at minute 1800. */
export const shiftEndMinutes = z.number().int().min(1).max(2880);

export const pagination = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function paged<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative().optional(),
  });
}

export const errorResponse = z.object({
  code: z.enum([
    'unauthenticated', 'forbidden', 'not_found', 'validation_failed',
    'conflict', 'precondition_failed', 'rate_limited', 'internal',
  ]),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});

// --- names -------------------------------------------------------------------
// No surname field. See packages/core/src/names.ts for why.

export const personName = z.object({
  givenName: z.string().min(1).max(60),
  fathersName: z.string().min(1).max(60),
  grandfathersName: z.string().max(60).optional().nullable(),
  givenNameAm: z.string().max(60).optional().nullable(),
  fathersNameAm: z.string().max(60).optional().nullable(),
  grandfathersNameAm: z.string().max(60).optional().nullable(),
});

// --- employees ---------------------------------------------------------------

export const employmentType = z.enum([
  'permanent', 'fixed_term', 'piece_work', 'casual', 'seasonal', 'intern',
]);

export const employmentStatus = z.enum([
  'probation', 'active', 'on_leave', 'suspended', 'notice_period', 'terminated',
]);

export const createEmployee = z
  .object({
    propertyId: uuid,
    employeeNo: z.string().min(1).max(24).optional(),
    name: personName,
    sex,
    dateOfBirth: isoDate,
    nationality: z.string().length(2).default('ET'),
    phone: ethiopianPhone,
    alternatePhone: ethiopianPhone.optional().nullable(),
    personalEmail: z.string().email().optional().nullable(),
    tin: tin.optional().nullable(),
    faydaNumber: z.string().max(32).optional().nullable(),
    workPermitNumber: z.string().max(32).optional().nullable(),
    workPermitExpiresOn: isoDate.optional().nullable(),
    emergencyContactName: z.string().max(120).optional().nullable(),
    emergencyContactPhone: ethiopianPhone.optional().nullable(),
    bankName: z.string().max(80).optional().nullable(),
    bankAccountNumber: z.string().max(40).optional().nullable(),
    contract: z.object({
      positionId: uuid,
      departmentId: uuid,
      employmentType,
      effectiveFrom: isoDate,
      contractEndsOn: isoDate.optional().nullable(),
      basicSalarySantim: santim,
      weeklyHours: z.number().min(1).max(48).default(48),
      weeklyRestWeekday: z.number().int().min(0).max(6),
      annualLeaveBonusDays: z.number().int().min(0).max(30).default(0),
      sharesServiceCharge: z.boolean().default(false),
    }),
    managerId: uuid.optional().nullable(),
  })
  .refine((v) => v.nationality === 'ET' || Boolean(v.workPermitNumber), {
    message: 'Non-Ethiopian staff need a work permit number',
    path: ['workPermitNumber'],
  })
  .refine((v) => v.contract.employmentType !== 'fixed_term' || Boolean(v.contract.contractEndsOn), {
    message: 'A fixed-term contract must state when it ends',
    path: ['contract', 'contractEndsOn'],
  });

export const employeeSummary = z.object({
  id: uuid,
  employeeNo: z.string(),
  displayName: z.string(),
  displayNameAm: z.string().nullable(),
  sex,
  status: employmentStatus,
  departmentId: uuid.nullable(),
  departmentName: z.string().nullable(),
  positionTitle: z.string().nullable(),
  phone: z.string(),
  photoUrl: z.string().nullable(),
  hiredOn: isoDate,
  yearsOfService: z.number().int(),
  /** Null when the caller lacks salary.read — a lock icon, not a missing field. */
  basicSalarySantim: santim.nullable(),
});

export const listEmployeesQuery = pagination.extend({
  propertyId: uuid,
  departmentId: uuid.optional(),
  status: employmentStatus.optional(),
  search: z.string().max(80).optional(),
  sort: z.enum(['name', 'hired_on', 'employee_no', 'department']).default('name'),
});

export const terminateEmployee = z.object({
  terminatedOn: isoDate,
  ground: z.enum([
    'resignation', 'mutual_agreement', 'contract_expiry', 'redundancy',
    'misconduct', 'incapacity', 'probation_failure', 'retirement', 'death',
  ]),
  reason: z.string().min(10, 'Record why, in enough detail to stand up at the labour bureau'),
  noticeServedOn: isoDate.optional().nullable(),
});

// --- rostering ---------------------------------------------------------------

export const rosterStatus = z.enum(['draft', 'in_review', 'published', 'archived']);

export const shiftAssignment = z.object({
  id: uuid,
  employeeId: uuid,
  employeeName: z.string(),
  workDate: isoDate,
  startMinutes: minutesOfDay,
  endMinutes: shiftEndMinutes,
  shiftCode: z.string().nullable(),
  shiftColour: z.string(),
  status: z.enum(['scheduled', 'confirmed', 'swap_requested', 'swapped', 'cancelled']),
});

export const rosterViolation = z.object({
  code: z.string(),
  severity: z.enum(['blocking', 'warning']),
  employeeId: uuid.optional(),
  date: isoDate.optional(),
  message: z.string(),
  legalBasis: z.string().optional(),
});

export const upsertAssignments = z.object({
  rosterId: uuid,
  assignments: z
    .array(
      z.object({
        id: uuid.optional(),
        employeeId: uuid,
        workDate: isoDate,
        shiftTemplateId: uuid.optional().nullable(),
        startMinutes: minutesOfDay,
        endMinutes: shiftEndMinutes,
        unpaidBreakMinutes: z.number().int().min(0).max(240).default(0),
      }),
    )
    .max(500),
});

// --- attendance --------------------------------------------------------------

export const punch = z.object({
  employeeId: uuid,
  direction: z.enum(['in', 'out', 'break_start', 'break_end']),
  punchedAt: isoDateTime.optional(),
  source: z.enum(['biometric', 'kiosk', 'mobile', 'web', 'supervisor', 'import']),
  deviceId: z.string().max(64).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  justification: z.string().min(5).optional(),
});

// --- leave -------------------------------------------------------------------

export const createLeaveRequest = z.object({
  employeeId: uuid,
  leaveTypeId: uuid,
  startsOn: isoDate,
  endsOn: isoDate,
  reason: z.string().max(500).optional(),
  documentId: uuid.optional().nullable(),
}).refine((v) => v.endsOn >= v.startsOn, {
  message: 'Leave cannot end before it starts',
  path: ['endsOn'],
});

export const decideLeaveRequest = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
});

// --- payroll -----------------------------------------------------------------

export const startPayrollRun = z.object({
  propertyId: uuid,
  ethiopianYear: z.number().int().min(2000).max(2100),
  ethiopianMonth: z.number().int().min(1).max(13),
});

export const payslipLine = z.object({
  code: z.string(),
  label: z.string(),
  labelAm: z.string().optional(),
  amountSantim: z.number().int(),
});

export const payslip = z.object({
  id: uuid,
  employeeId: uuid,
  employeeNo: z.string(),
  legalName: z.string(),
  positionTitle: z.string(),
  departmentName: z.string(),
  basicSalarySantim: santim,
  grossSantim: santim,
  taxableGrossSantim: santim,
  payeSantim: santim,
  employeePensionSantim: santim,
  employerPensionSantim: santim,
  otherDeductionsSantim: santim,
  netPaySantim: z.number().int(),
  employerCostSantim: santim,
  earningLines: z.array(payslipLine),
  deductionLines: z.array(payslipLine),
  warnings: z.array(z.string()),
});

// --- auth --------------------------------------------------------------------

export const login = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().length(6).optional(),
});

export const session = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
  user: z.object({
    id: uuid,
    displayName: z.string(),
    employeeId: uuid.nullable(),
    locale,
    preferredCalendar: z.enum(['ethiopian', 'gregorian']),
    permissions: z.array(z.string()),
    properties: z.array(z.object({ id: uuid, name: z.string(), code: z.string() })),
  }),
});

// --- inferred types ----------------------------------------------------------

export type PersonName = z.infer<typeof personName>;
export type CreateEmployee = z.infer<typeof createEmployee>;
export type EmployeeSummary = z.infer<typeof employeeSummary>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuery>;
export type ShiftAssignment = z.infer<typeof shiftAssignment>;
export type RosterViolation = z.infer<typeof rosterViolation>;
export type Punch = z.infer<typeof punch>;
export type CreateLeaveRequest = z.infer<typeof createLeaveRequest>;
export type Payslip = z.infer<typeof payslip>;
export type Session = z.infer<typeof session>;
export type ErrorResponse = z.infer<typeof errorResponse>;
