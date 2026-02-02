# PRD: SetView Table Sorting & Filtering

## Summary
Add sorting and filtering capabilities to the SetView table to help users quickly find specific cards within a set.

## Background
The current [SetView.jsx](../src/components/Set/SetView.jsx) displays all cards in a set using RSuite's virtualized Table component. There is an existing TODO (line 19-21) to add sorting for name, type, rarity, and color columns. This PRD expands on that to include filtering.

## Goals
1. Enable column sorting (ascending/descending) for all columns
2. Add filtering controls to narrow down displayed cards
3. Maintain performance with large sets (300+ cards)
4. Preserve mobile responsiveness

## User Stories

| ID | Story | Priority |
|----|-------|----------|
| US-1 | As a user, I want to sort cards by name alphabetically | P0 |
| US-2 | As a user, I want to sort cards by rarity (common → mythic) | P0 |
| US-3 | As a user, I want to sort cards by type | P1 |
| US-4 | As a user, I want to filter cards by color | P0 |
| US-5 | As a user, I want to filter cards by rarity | P1 |
| US-6 | As a user, I want to filter cards by type (creature, instant, etc.) | P1 |
| US-7 | As a user, I want to search cards by name within the set | P0 |
| US-8 | As a user, I want to clear all filters with one click | P2 |

## Functional Requirements

### Sorting

| Column | Sort Type | Default Order |
|--------|-----------|---------------|
| Name | Alphabetical | A → Z |
| Type | Alphabetical | A → Z |
| Rarity | Custom order | Common → Uncommon → Rare → Mythic |
| Colors | Custom order | W → U → B → R → G → Multicolor → Colorless |

- Click column header to toggle sort (none → asc → desc → none)
- Visual indicator showing current sort column and direction
- Only one column sorted at a time

### Filtering

| Filter | Type | Options |
|--------|------|---------|
| Name | Text input | Free text search |
| Color | Multi-select checkboxes | W, U, B, R, G, Colorless, Multicolor |
| Rarity | Multi-select checkboxes | Common, Uncommon, Rare, Mythic |
| Type | Multi-select dropdown | Creature, Instant, Sorcery, Enchantment, Artifact, Land, Planeswalker |

- Filters apply with AND logic (all conditions must match)
- Color filter matches cards containing ANY selected color
- Show count of filtered results (e.g., "Showing 45 of 280 cards")
- Filters persist during sorting

## UI Design

### Desktop Layout
```
┌─────────────────────────────────────────────────────────┐
│ NavigationBar                                           │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Search by name...    ] [Color ▼] [Rarity ▼] [Type ▼] │
│ │                                    [Clear Filters]  │ │
│ └─────────────────────────────────────────────────────┘ │
│ Showing 45 of 280 cards                                 │
├─────────────────────────────────────────────────────────┤
│ Name ▲    │ Type      │ Rarity    │ Colors  │ Set      │
├───────────┼───────────┼───────────┼─────────┼──────────┤
│ Card A    │ Creature  │ Common    │ W       │ Set Name │
│ Card B    │ Instant   │ Rare      │ U, B    │ Set Name │
└─────────────────────────────────────────────────────────┘
```

### Mobile Layout
```
┌──────────────────────────┐
│ NavigationBar            │
├──────────────────────────┤
│ [Search by name...     ] │
│ [Filters ▼] [Clear]      │
│ Showing 45 of 280 cards  │
├──────────────────────────┤
│ Name ▲       │ Type      │
├──────────────┼───────────┤
│ Card A       │ Creature  │
│ Card B       │ Instant   │
└──────────────────────────┘
```

## Technical Approach

### State Management
```javascript
const [sortColumn, setSortColumn] = useState(null);
const [sortType, setSortType] = useState(null); // 'asc' | 'desc'
const [filters, setFilters] = useState({
  name: '',
  colors: [],
  rarity: [],
  type: []
});
```

### Sorting Implementation
- Use RSuite Table's built-in `sortColumn` and `sortType` props
- Implement `onSortColumn` handler
- Custom comparator for rarity and color ordering

### Filtering Implementation
- Filter data before passing to Table
- Use `useMemo` to memoize filtered/sorted results
- Debounce name search input (300ms)

### Components to Create/Modify

| Component | Action | Description |
|-----------|--------|-------------|
| `SetView.jsx` | Modify | Add sorting state and handlers |
| `SetFilters.jsx` | Create | Filter controls component |
| `useCardFilters.js` | Create | Custom hook for filter logic |

## Acceptance Criteria

- [ ] All columns sortable with visual indicators
- [ ] Rarity sorts in correct order (common → mythic)
- [ ] Name search filters as user types (debounced)
- [ ] Color, rarity, and type filters work correctly
- [ ] "Clear Filters" resets all filters and sort
- [ ] Result count updates dynamically
- [ ] Table remains performant with 500+ cards
- [ ] Mobile layout shows collapsible filter panel
- [ ] Filters preserved when sorting changes

## Out of Scope
- Server-side sorting/filtering
- Saved filter presets
- Export filtered results
- Advanced query syntax

## Dependencies
- RSuite Table (already installed)
- No new packages required

## Estimated Effort
- Development: 4-6 hours
- Testing: 1-2 hours
