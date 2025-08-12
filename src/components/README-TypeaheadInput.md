# TypeaheadInput Component

A reusable React component that provides typeahead/autocomplete functionality for event types.

## Features

- **Controlled Component**: Uses `value` and `onChange` props for external state control
- **API Integration**: Fetches event types from `listEventTypes()` API on component mount
- **Smart Filtering**: Case-insensitive filtering using `startsWith()` method
- **Keyboard Navigation**: Full keyboard support (↑/↓ arrows, Enter, Escape)
- **Mouse Support**: Click to select suggestions
- **Click Outside**: Automatically closes dropdown when clicking outside
- **Accessibility**: ARIA attributes for screen reader compatibility
- **Consistent Styling**: Matches existing input styles in the application
- **Performance**: Limits suggestions to maximum of 5 items

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | Yes | The current input value (controlled) |
| `onChange` | `(value: string) => void` | Yes | Callback fired when value changes |
| `placeholder` | `string` | No | Input placeholder text |
| `className` | `string` | No | Additional CSS classes for width overrides |

## Internal State

- `allTypes: string[]` - Complete list of event types fetched from API
- `isOpen: boolean` - Controls dropdown visibility
- `highlightIdx: number` - Currently highlighted suggestion index (-1 when none)

## Behavior

### Filtering
- Filters `allTypes` using case-insensitive `startsWith()` matching
- Shows maximum 5 suggestions to keep dropdown manageable
- Only shows dropdown when there are matching suggestions

### Keyboard Navigation
- **↑/↓ Arrow Keys**: Navigate through suggestions
- **Enter**: Select highlighted suggestion
- **Escape**: Close dropdown
- **Arrow Down** (when closed): Opens dropdown if suggestions exist

### Mouse Interaction
- **Click suggestion**: Selects the item
- **Hover suggestion**: Highlights the item
- **Click outside**: Closes dropdown

## Styling

### Input Field
- Uses existing input classes: `"rounded-md border border-[color:color-mix(in_oklch,var(--color-neon-cyan)_22%,transparent)] bg-transparent px-2 py-1"`
- Full width by default (`w-full`)
- Can be overridden with `className` prop

### Dropdown
- Positioned absolutely below input (`top-full left-0 w-full`)
- Dark background: `bg-[#0b0b12]`
- Neon cyan border matching input
- Small text: `text-sm`
- High z-index: `z-50`
- Max height with scroll: `max-h-40 overflow-y-auto`

### Suggestion Highlighting
- Highlighted: `bg-[color:color-mix(in_oklch,var(--color-neon-cyan)_20%,transparent)]`
- Hover: `bg-[color:color-mix(in_oklch,var(--color-neon-cyan)_10%,transparent)]`

## Accessibility

The component includes comprehensive ARIA attributes:

- `aria-expanded`: Indicates if dropdown is open
- `aria-controls`: Associates input with dropdown
- `aria-haspopup="listbox"`: Indicates popup type
- `aria-autocomplete="list"`: Describes autocomplete behavior
- `role="listbox"` on dropdown
- `role="option"` on each suggestion
- `aria-selected` on highlighted option

## Usage Example

```tsx
import { useState } from 'react'
import TypeaheadInput from './components/TypeaheadInput'

function MyComponent() {
  const [eventType, setEventType] = useState('')

  return (
    <div>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-[--color-subtle]">Event Type</span>
        <TypeaheadInput
          value={eventType}
          onChange={setEventType}
          placeholder="Start typing... (e.g. medication, trigger, note)"
        />
      </label>
    </div>
  )
}
```

## Integration with Existing Forms

The component can easily replace existing text inputs in forms:

```tsx
// Before
<input
  className="rounded-md border border-[color:color-mix(in_oklch,var(--color-neon-cyan)_22%,transparent)] bg-transparent px-2 py-1"
  type='text'
  value={eventType}
  onChange={(e) => setEventType(e.target.value)}
  placeholder="medication, trigger, note..."
/>

// After
<TypeaheadInput
  value={eventType}
  onChange={setEventType}
  placeholder="medication, trigger, note..."
/>
```

## Error Handling

- API errors are logged to console but don't break the component
- Component gracefully falls back to regular text input if API fails
- No suggestions shown if `allTypes` is empty

## Performance Considerations

- Event types are fetched only once on component mount
- Filtering is performed client-side for fast response
- Dropdown is limited to 5 suggestions maximum
- Click outside handler is properly cleaned up on unmount
