'use client';

import { useState } from 'react';
import { Input } from './Form';
import { Button } from './Button';
import { Search, X } from 'lucide-react';

export interface FilterConfig {
  field: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange';
  options?: Array<{ value: string; label: string }>;
}

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onFilter: (filters: Record<string, any>) => void;
  filterConfigs?: FilterConfig[];
  placeholder?: string;
}

export const SearchFilter = ({
  onSearch,
  onFilter,
  filterConfigs = [],
  placeholder = 'Search...',
}: SearchFilterProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const handleFilterChange = (field: string, value: any) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilters({});
    onSearch('');
    onFilter({});
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== '' && v !== null && v !== undefined
  ).length;

  return (
    <div className="space-y-3 mb-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Toggle & Clear */}
      <div className="flex gap-2">
        {filterConfigs.length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </>
        )}

        {(searchQuery || activeFilterCount > 0) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && filterConfigs.length > 0 && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          {filterConfigs.map((config) => (
            <div key={config.field}>
              <label className="block text-sm font-medium mb-1">
                {config.label}
              </label>

              {config.type === 'text' && (
                <Input
                  type="text"
                  placeholder={`Filter by ${config.label.toLowerCase()}...`}
                  value={filters[config.field] || ''}
                  onChange={(e) =>
                    handleFilterChange(config.field, e.target.value)
                  }
                />
              )}

              {config.type === 'select' && config.options && (
                <select
                  value={filters[config.field] || ''}
                  onChange={(e) =>
                    handleFilterChange(config.field, e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  {config.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {config.type === 'date' && (
                <Input
                  type="date"
                  value={filters[config.field] || ''}
                  onChange={(e) =>
                    handleFilterChange(config.field, e.target.value)
                  }
                />
              )}

              {config.type === 'daterange' && (
                <div className="flex gap-2">
                  <Input
                    type="date"
                    placeholder="From"
                    value={filters[`${config.field}_from`] || ''}
                    onChange={(e) =>
                      handleFilterChange(`${config.field}_from`, e.target.value)
                    }
                  />
                  <Input
                    type="date"
                    placeholder="To"
                    value={filters[`${config.field}_to`] || ''}
                    onChange={(e) =>
                      handleFilterChange(`${config.field}_to`, e.target.value)
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
