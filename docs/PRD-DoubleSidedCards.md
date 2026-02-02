# PRD: Fix Double-Sided Cards in Card Search

## Problem Statement
Double-sided cards (transform, modal double-faced, flip cards) do not load properly in Card Search. The issue manifests in two ways:
1. **URL Routing Error**: Card names containing `//` (e.g., "Delver of Secrets // Insectile Aberration") break React Router navigation
2. **Missing Image/Data**: Double-sided cards store `image_uris` and `oracle_text` in `card_faces[]` array instead of top-level properties, causing null/undefined renders

## Root Cause Analysis

### Issue 1: URL Path Breaking
- Card names with `//` are used directly in URL paths (e.g., `/cards/:id`)
- When navigating to a card by name, the `//` is interpreted as part of the URL path
- Example: `/cards/Delver of Secrets // Insectile Aberration` breaks routing

### Issue 2: Missing Card Face Data
Scryfall API returns double-sided cards with this structure:
```json
{
  "name": "Delver of Secrets // Insectile Aberration",
  "layout": "transform",
  "image_uris": null,  // <-- No top-level image
  "oracle_text": null, // <-- No top-level oracle text
  "card_faces": [
    {
      "name": "Delver of Secrets",
      "image_uris": { "png": "...", "normal": "..." },
      "oracle_text": "At the beginning of your upkeep..."
    },
    {
      "name": "Insectile Aberration",
      "image_uris": { "png": "...", "normal": "..." },
      "oracle_text": "Flying"
    }
  ]
}
```

Current code in `CardView.jsx` accesses:
- `card?.image_uris?.png` → returns `undefined`
- `card?.oracle_text` → returns `undefined`

## Affected Files

| File | Issue |
|------|-------|
| `src/components/Card/CardView.jsx` | Does not handle `card_faces` array |
| `src/components/Shared/Card/ViewCard.jsx` | Does not handle `card_faces` array |
| `src/components/Shared/SearchBar.jsx` | Passes card name with `//` to navigation |
| `src/components/Card/CardSearch.jsx` | Uses card name in URL path |

## Solution

### Phase 1: Handle Card Faces in Display Components

**CardView.jsx changes:**
1. Add helper function to extract image URI:
   ```javascript
   const getImageUri = (card) => {
     if (card?.image_uris?.png) return card.image_uris.png;
     if (card?.card_faces?.[0]?.image_uris?.png) return card.card_faces[0].image_uris.png;
     return null;
   };
   ```

2. Add helper function to extract oracle text:
   ```javascript
   const getOracleText = (card) => {
     if (card?.oracle_text) return card.oracle_text;
     if (card?.card_faces) {
       return card.card_faces.map(face => `${face.name}: ${face.oracle_text}`).join('\n\n');
     }
     return null;
   };
   ```

3. For double-sided cards, display both faces:
   - Show front face image by default
   - Add flip/toggle button to view back face
   - Display oracle text for both faces

### Phase 2: Fix URL Routing

**Option A (Recommended): Use Card ID instead of name**
- Already using card ID in route (`/cards/:id`)
- Ensure `SearchBar.jsx` passes `card.id` not `card.name` to navigation
- Update `onSelect` handler in `CardSearch.jsx` to navigate using ID

**Option B: Encode card names**
- URL-encode the card name when navigating
- Decode on the receiving component

### Phase 3: Enhanced Double-Sided Card UX

1. Add visual indicator for double-sided cards in search results
2. Add toggle/flip button to switch between faces in CardView
3. Display both face images side-by-side on desktop

## Acceptance Criteria

- [ ] Double-sided cards appear in search results
- [ ] Clicking a double-sided card navigates to CardView without errors
- [ ] CardView displays the front face image
- [ ] CardView shows oracle text for both faces
- [ ] User can toggle to view the back face image
- [ ] Power/Toughness displays correctly for each face (if applicable)
- [ ] Works on both mobile and desktop views

## Technical Implementation

### Step 1: Update CardView.jsx
```javascript
// Add state for active face
const [activeFace, setActiveFace] = useState(0);

// Helper to check if card is double-faced
const isDoubleFaced = (card) => card?.card_faces && !card?.image_uris;

// Get current face data
const getCurrentFace = (card) => {
  if (isDoubleFaced(card)) {
    return card.card_faces[activeFace];
  }
  return card;
};
```

### Step 2: Update SearchBar/CardSearch navigation
Ensure navigation uses card ID:
```javascript
navigate(`/cards/${selectedCard.id}`);
```

### Step 3: Update image rendering
```javascript
<img
  src={isDoubleFaced(card) 
    ? card.card_faces[activeFace]?.image_uris?.png 
    : card?.image_uris?.png}
  alt={card?.name}
  height="475"
/>
```

## Testing Scenarios

| Scenario | Card Example | Expected Result |
|----------|--------------|-----------------|
| Transform card | "Delver of Secrets // Insectile Aberration" | Both faces display, can toggle |
| Modal DFC | "Valki, God of Lies // Tibalt, Cosmic Impostor" | Both faces display, can toggle |
| Normal card | "Lightning Bolt" | Standard display, no toggle |
| Search + Navigate | Search "Delver", click result | Navigates without URL error |

## Dependencies
- No new dependencies required
- Uses existing RSuite components for toggle button

## Estimated Effort
- **Phase 1**: 2-3 hours
- **Phase 2**: 1 hour  
- **Phase 3**: 2-3 hours
- **Testing**: 1-2 hours
- **Total**: ~8 hours

## Priority
**High** - Listed as Bug #1 in main PRD, affects core search functionality
