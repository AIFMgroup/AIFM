'use client';

import { Button } from './Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onGoToPage?: (page: number) => void;
  showPageNumbers?: boolean;
}

export const Pagination = ({
  page,
  totalPages,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onGoToPage,
  showPageNumbers = true,
}: PaginationProps) => {
  const pageNumbers = generatePageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t">
      <div className="text-sm text-muted-foreground">
        Page <span className="font-semibold">{page}</span> of{' '}
        <span className="font-semibold">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Prev Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevPage}
          disabled={!hasPrevPage}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Page Numbers */}
        {showPageNumbers && (
          <div className="flex gap-1">
            {pageNumbers.map((num) =>
              num === '...' ? (
                <span key={num} className="px-2 py-1 text-muted-foreground">
                  {num}
                </span>
              ) : (
                <Button
                  key={num}
                  variant={page === num ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onGoToPage?.(num as number)}
                  className="w-10 h-10 p-0"
                >
                  {num}
                </Button>
              )
            )}
          </div>
        )}

        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onNextPage}
          disabled={!hasNextPage}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

/**
 * Generate array of page numbers to display
 * Shows first page, last page, current page +/- 1
 */
function generatePageNumbers(
  currentPage: number,
  totalPages: number
): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [1];

  if (currentPage > 3) {
    pages.push('...');
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push('...');
  }

  pages.push(totalPages);

  return pages;
}
