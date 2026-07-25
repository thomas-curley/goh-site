"use client";

import Link from "next/link";

interface NavDropdownItem {
  href: string;
  label: string;
}

export function NavDropdown({
  label,
  items,
  open,
  onToggle,
  onClose,
}: {
  label: string;
  items: NavDropdownItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative" data-nav-dropdown>
      <button
        onClick={onToggle}
        className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors cursor-pointer"
      >
        {label}
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-48 card-wood py-1 z-50 shadow-xl">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="block px-4 py-2 text-sm text-bark-brown hover:bg-parchment-dark transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
