/** Shapes shared between the server-fetched rows and the local CRUD overlay. */

export interface EmployeeRecord {
  id: string;
  employeeNo: string;
  givenName: string;
  fathersName: string;
  grandfathersName: string | null;
  givenNameAm: string | null;
  fathersNameAm: string | null;
  sex: 'male' | 'female';
  phone: string;
  status: string;
  hiredOn: string;
  departmentId: string;
  departmentName: string;
  positionTitle: string | null;
  yearsOfService: number | null;
}

export interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  nameAm: string | null;
  isOperational: boolean;
  headcount: number;
  positionTitle: string | null;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface EmployeeOption {
  id: string;
  name: string;
  employeeNo: string;
  departmentCode: string;
  departmentColour: string;
}

/** A tag-board entry — keyed by employee id so `useLocalOverlay` can add/remove entries directly. */
export interface OnDutyEntry {
  id: string;
  employeeNumber: string;
  shortName: string;
  amharicName: string;
  departmentCode: string;
  departmentColour: string;
  clockedInMinutes: number;
  isLate: boolean;
}

export interface LeaveRequestEntry {
  id: string;
  employeeId?: string;
  employeeName: string;
  leaveTypeName: string;
  startsOn: string;
  endsOn: string;
  workingDays: string;
  status: string;
  reason?: string | null;
  decisionNote?: string | null;
}

export interface ShiftTemplateOption {
  id: string;
  code: string;
  name: string;
  colour: string;
  startMinutes: number;
  endMinutes: number;
}

export interface ShiftAssignmentEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  workDate: string;
  shiftTemplateId: string;
  shiftCode: string;
  shiftColour: string;
  startMinutes: number;
  endMinutes: number;
}

export interface PayrollRunEntry {
  id: string;
  status: string;
  calculatedBy: string;
  calculatedByName: string;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface ApproverOption {
  id: string;
  name: string;
}
