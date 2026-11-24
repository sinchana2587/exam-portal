import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science & Engineering' },
  { code: 'ISE', name: 'Information Science & Engineering' },
  { code: 'ECE', name: 'Electronics & Communication Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'CIVIL', name: 'Civil Engineering' },
  { code: 'AIML', name: 'Artificial Intelligence & Machine Learning' }
];

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem('protick_user_role') || 'COE');
  const [department, setDepartment] = useState(() => localStorage.getItem('protick_user_dept') || 'ALL');
  const [userName, setUserName] = useState(() => localStorage.getItem('protick_user_name') || 'Dr. K. S. Ramesh (COE)');

  useEffect(() => {
    localStorage.setItem('protick_user_role', role);
    localStorage.setItem('protick_user_dept', department);
    localStorage.setItem('protick_user_name', userName);
  }, [role, department, userName]);

  const switchRole = (newRole, newDept = 'ALL', newName = '') => {
    setRole(newRole);
    setDepartment(newDept);
    if (newName) {
      setUserName(newName);
    } else if (newRole === 'COE') {
      setUserName('Dr. K. S. Ramesh (Controller of Examinations)');
      setDepartment('ALL');
    } else {
      setUserName(`Prof. HOD (${newDept || 'CSE'})`);
      setDepartment(newDept || 'CSE');
    }
  };

  const isCOE = role === 'COE' || role === 'Admin';

  return (
    <AuthContext.Provider value={{
      role,
      department,
      userName,
      isCOE,
      departments: DEPARTMENTS,
      switchRole
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

