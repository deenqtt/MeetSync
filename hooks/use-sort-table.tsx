// hooks/use-sort-table.ts
import { useState } from "react"

// Helper function to get nested value from an object using a string path
// e.g., getNestedValue(device, "profile.name")
function getNestedValue(obj: any, path: string) {
  return path.split('.').reduce((acc, part) => {
    // Safely navigate, returning undefined if a part is null/undefined
    return acc && typeof acc === 'object' ? acc[part] : undefined;
  }, obj);
}

// Define return type for the hook
export interface UseSortableTableReturn<T> {
  sorted: T[];
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  handleSort: (field: string) => void;
}

// Define a more flexible type for the sortField to allow string paths
export function useSortableTable<T extends Record<string, any>>(
  data: T[],
  customSort?: (a: T, b: T) => number
): UseSortableTableReturn<T> { // T must be an object type
  // sortField can now be a string representing a path or a direct key
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => { // field is now a string path
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    // If custom sort function is provided, use it
    if (customSort) {
      return customSort(a, b);
    }

    if (!sortField) return 0;

    // Use the getNestedValue helper to retrieve the actual values for comparison
    const aValue = getNestedValue(a, sortField);
    const bValue = getNestedValue(b, sortField);

    // Handle null/undefined values by treating them as empty strings or numbers
    const normalizedA = aValue ?? '';
    const normalizedB = bValue ?? '';

    if (typeof normalizedA === 'string' && typeof normalizedB === 'string') {
      return sortDirection === 'asc'
        ? normalizedA.localeCompare(normalizedB)
        : normalizedB.localeCompare(normalizedA);
    }

    if (typeof normalizedA === 'number' && typeof normalizedB === 'number') {
      return sortDirection === 'asc' ? normalizedA - normalizedB : normalizedB - normalizedA;
    }

    // Fallback for other types or incomparable types
    return 0;
  });

  return {
    sorted,
    sortField,
    sortDirection,
    handleSort,
  };
}
