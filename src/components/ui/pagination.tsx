"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  urlTemplate,
}: {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  urlTemplate?: string;
}) {
  if (totalPages <= 1) return null;

  const startItem = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : undefined;
  const endItem = totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : undefined;

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const resolveHref = (targetPage: number) => {
    if (!urlTemplate) return "#";
    return urlTemplate
      .replace("{page}", targetPage.toString())
      .replace("%7Bpage%7D", targetPage.toString());
  };

  const renderButton = (
    key: string,
    pageNum: number,
    label: React.ReactNode,
    isActive = false,
    disabled = false,
    title?: string
  ) => {
    const className = `inline-flex items-center justify-center min-w-[32px] h-8 px-2 text-xs font-semibold rounded-md border transition-all ${
      isActive
        ? "bg-neutral-900 text-white border-neutral-900 shadow-2xs"
        : disabled
        ? "bg-neutral-50 text-neutral-300 border-neutral-200 cursor-not-allowed opacity-50 select-none"
        : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900 cursor-pointer shadow-2xs"
    }`;

    if (urlTemplate && !disabled) {
      return (
        <Link
          key={key}
          href={resolveHref(pageNum)}
          className={className}
          title={title}
          aria-label={title}
        >
          {label}
        </Link>
      );
    }

    return (
      <button
        key={key}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          if (onPageChange) {
            onPageChange(pageNum);
          }
        }}
        className={className}
        title={title}
        aria-label={title}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white border-t border-neutral-200 text-xs select-none">
      <div className="text-neutral-500">
        {startItem && endItem && totalItems ? (
          <span>
            Showing <strong className="text-neutral-900">{startItem}</strong> to{" "}
            <strong className="text-neutral-900">{endItem}</strong> of{" "}
            <strong className="text-neutral-900">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="text-neutral-900">{currentPage}</strong> of{" "}
            <strong className="text-neutral-900">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 self-center sm:self-auto">
        {/* Previous Button (< / Left arrow) */}
        {renderButton(
          "pagination-prev-btn",
          prevPage,
          <ChevronLeft className="w-3.5 h-3.5 pointer-events-none" />,
          false,
          currentPage <= 1,
          "Previous Page"
        )}

        {/* Page Numbers */}
        {pages.map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`dots-${idx}`} className="px-1 text-neutral-400 select-none">
                ...
              </span>
            );
          }
          return renderButton(
            `pagination-page-${p}`,
            p as number,
            p,
            p === currentPage,
            false,
            `Page ${p}`
          );
        })}

        {/* Next Button (> / Right arrow) */}
        {renderButton(
          "pagination-next-btn",
          nextPage,
          <ChevronRight className="w-3.5 h-3.5 pointer-events-none" />,
          false,
          currentPage >= totalPages,
          "Next Page"
        )}
      </div>
    </div>
  );
}
