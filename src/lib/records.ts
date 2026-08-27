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
