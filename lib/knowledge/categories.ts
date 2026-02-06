/**
 * Knowledge Base Categories
 * Predefined categories for organizing shared knowledge
 */

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  color: string;
}

export const KNOWLEDGE_CATEGORIES: Category[] = [
  {
    id: 'clients',
    name: 'Klienter',
    nameEn: 'Clients',
    description: 'Information om klienter, investerare och affärsrelationer',
    icon: 'users',
    color: 'blue',
  },
  {
    id: 'negotiations',
    name: 'Förhandlingar',
    nameEn: 'Negotiations',
    description: 'Förhandlingshistorik, avtal och affärsvillkor',
    icon: 'handshake',
    color: 'green',
  },
  {
    id: 'compliance',
    name: 'Compliance',
    nameEn: 'Compliance',
    description: 'Regulatoriska frågor, policyer och riktlinjer',
    icon: 'shield',
    color: 'purple',
  },
  {
    id: 'internal',
    name: 'Intern',
    nameEn: 'Internal',
    description: 'Interna processer, rutiner och företagsinformation',
    icon: 'building',
    color: 'orange',
  },
];

export function getCategoryById(id: string): Category | undefined {
  return KNOWLEDGE_CATEGORIES.find(c => c.id === id);
}

export function getCategoryName(id: string): string {
  return getCategoryById(id)?.name || id;
}

export function getCategoryColor(id: string): string {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
  };
  const category = getCategoryById(id);
  return colors[category?.color || 'blue'] || colors.blue;
}
