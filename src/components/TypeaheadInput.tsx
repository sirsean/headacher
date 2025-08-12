import { useState, useEffect, useRef, useCallback } from 'react'
import { listEventTypes } from '../api'
import { useAuth } from '../context/AuthContext'

interface TypeaheadInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function TypeaheadInput({
  value,
  onChange,
  placeholder,
  className
}: TypeaheadInputProps) {
  const { fetchWithAuth } = useAuth()
  const [allTypes, setAllTypes] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)
  const listboxId = useRef(`typeahead-listbox-${Math.random().toString(36).substr(2, 9)}`)

  // Fetch event types on mount
  useEffect(() => {
    async function fetchTypes() {
      try {
        const result = await listEventTypes(fetchWithAuth)
        setAllTypes(result.types)
      } catch (error) {
        console.error('Failed to fetch event types:', error)
      }
    }
    fetchTypes()
  }, [fetchWithAuth])

  // Filter types based on current input value (case-insensitive, startsWith)
  const filteredTypes = allTypes
    .filter(type => type.toLowerCase().startsWith(value.toLowerCase()))
    .slice(0, 5) // Max 5 suggestions

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        inputRef.current &&
        dropdownRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setHighlightIdx(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectItem = useCallback((item: string) => {
    onChange(item)
    setIsOpen(false)
    setHighlightIdx(-1)
    inputRef.current?.focus()
  }, [onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setIsOpen(true)
    setHighlightIdx(-1)
  }

  const handleInputFocus = () => {
    if (filteredTypes.length > 0) {
      setIsOpen(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && filteredTypes.length > 0) {
        e.preventDefault()
        setIsOpen(true)
        setHighlightIdx(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIdx(prev => 
          prev < filteredTypes.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIdx(prev => prev > 0 ? prev - 1 : prev)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIdx >= 0 && highlightIdx < filteredTypes.length) {
          selectItem(filteredTypes[highlightIdx])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setHighlightIdx(-1)
        break
    }
  }

  const showDropdown = isOpen && filteredTypes.length > 0

  return (
    <div className={`relative ${className || ''}`}>
      <input
        ref={inputRef}
        className="rounded-md border border-[color:color-mix(in_oklch,var(--color-neon-cyan)_22%,transparent)] bg-transparent px-2 py-1 w-full"
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listboxId.current : undefined}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />
      {showDropdown && (
        <ul
          ref={dropdownRef}
          id={listboxId.current}
          role="listbox"
          className="absolute top-full left-0 w-full bg-[#0b0b12] border border-[color:color-mix(in_oklch,var(--color-neon-cyan)_22%,transparent)] rounded-md mt-1 py-1 text-sm z-50 max-h-40 overflow-y-auto"
        >
          {filteredTypes.map((type, index) => (
            <li
              key={type}
              role="option"
              aria-selected={index === highlightIdx}
              className={`px-2 py-1 cursor-pointer ${
                index === highlightIdx
                  ? 'bg-[color:color-mix(in_oklch,var(--color-neon-cyan)_20%,transparent)]'
                  : 'hover:bg-[color:color-mix(in_oklch,var(--color-neon-cyan)_10%,transparent)]'
              }`}
              onClick={() => selectItem(type)}
              onMouseEnter={() => setHighlightIdx(index)}
            >
              {type}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
