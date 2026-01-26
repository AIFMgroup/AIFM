'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Company, mockCompanies } from '@/lib/companyData';

interface CompanyContextType {
  selectedCompany: Company;
  setSelectedCompany: (company: Company) => void;
  companies: Company[];
  isLoading: boolean;
  switchCompany: (company: Company) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<Company>(mockCompanies[0]);
  const [isLoading, setIsLoading] = useState(false);

  // Switch company with loading animation
  const switchCompany = useCallback((company: Company) => {
    if (company.id === selectedCompany.id) return;
    
    setIsLoading(true);
    
    // Simulate loading data for new company
    setTimeout(() => {
      setSelectedCompany(company);
      setIsLoading(false);
    }, 800);
  }, [selectedCompany.id]);

  return (
    <CompanyContext.Provider value={{ 
      selectedCompany, 
      setSelectedCompany, 
      companies: mockCompanies,
      isLoading,
      switchCompany
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

// Default fallback company for SSR
const defaultCompany: Company = {
  id: 'default',
  name: 'Läser in...',
  shortName: 'Läser in',
  orgNumber: '000000-0000',
  type: 'OPERATING',
  status: 'ACTIVE',
  color: '#c0a280',
};

export function useCompany() {
  const context = useContext(CompanyContext);
  // Return a safe default instead of throwing during SSR
  if (!context) {
    return {
      selectedCompany: defaultCompany,
      setSelectedCompany: () => {},
      companies: [],
      isLoading: true,
      switchCompany: () => {},
    };
  }
  return context;
}
