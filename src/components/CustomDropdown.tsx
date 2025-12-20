import { useState, useRef, useEffect } from "react";

interface DropdownOption {
  value: number | string;
  label: string;
}

interface CustomDropdownProps {
  value: number | string;
  onChange: (value: number) => void;
  options: DropdownOption[];
  className?: string;
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  className = "",
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Dropdown trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md border border-[color:color-mix(in_oklch,var(--color-neon-cyan)_40%,transparent)] bg-[--color-panel] px-3 py-1.5 text-[--color-ink] hover:border-[--color-neon-cyan] focus:border-[--color-neon-cyan] focus:outline-none focus:ring-1 focus:ring-[--color-neon-cyan] transition-colors cursor-pointer min-w-[110px] justify-between"
      >
        <span>{selectedOption?.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-[--color-neon-cyan] bg-[--color-bg] shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-sm">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(Number(option.value));
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                option.value === value
                  ? "bg-[color:color-mix(in_oklch,var(--color-neon-cyan)_35%,var(--color-bg))] text-[--color-ink] font-medium"
                  : "text-[--color-ink] hover:bg-[color:color-mix(in_oklch,var(--color-neon-cyan)_20%,var(--color-bg))]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
