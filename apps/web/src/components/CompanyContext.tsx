'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Company, mockCompanies } from '@/lib/companyData';

interface CompanyContextType {
  selectedCompany: Company;
  setSelectedCompany: (company: Company) => void;
  companies: Company[];
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<Company>(mockCompanies[0]);

  return (
    <CompanyContext.Provider value={{ selectedCompany, setSelectedCompany, companies: mockCompanies }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

