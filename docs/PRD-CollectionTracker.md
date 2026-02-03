# Product Requirements Document: Collection Tracker

## Overview
The Collection Tracker feature enables MTG Card Loader users to catalog, manage, and view their personal Magic: The Gathering card collections with detailed information about each owned card.

## Problem Statement
MTG collectors lack a convenient way to track their card inventory within the existing card lookup workflow. They need to:
- Know which cards they own and how many copies
- Track different printings/editions of the same card
- Record purchase prices and card conditions
- Quickly search and browse their collection

## Target Users
- Card collectors managing personal inventories
- Players tracking cards for deck building
- Traders needing visibility into their available cards

---

## Core Features

### 1. User Authentication
- **Status**: Not Implemented
- **Priority**: High (prerequisite for all other features)

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| AUTH-1 | User registration with email/password | |
| AUTH-2 | User login/logout | Persistent sessions |
| AUTH-3 | Protected routes requiring authentication | Collection pages |
| AUTH-4 | Password reset functionality | Email-based |

#### Technical Approach
- JWT-based authentication
- Store user credentials in database (hashed passwords)
- Session tokens stored in httpOnly cookies or localStorage

---

### 2. Collection Storage
- **Status**: Not Implemented
- **Priority**: High

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| STORE-1 | Persistent storage for user collections | Database required |
| STORE-2 | Store card reference (Scryfall ID) | Links to Scryfall data |
| STORE-3 | Store quantity per card entry | Integer, min 1 |
| STORE-4 | Store purchase price | USD, optional |
| STORE-5 | Store card condition | Enum: Mint, NM, LP, MP, HP, Damaged |
| STORE-6 | Store acquisition date | Optional |
| STORE-7 | Support multiple entries of same card | Different conditions/prices |

#### Data Model
```
Collection {
  id: UUID
  userId: UUID (FK to User)
  name: String
  type: Enum (TRADE_BINDER, DECK)
  deckType: Enum (nullable) // Only for DECK type: COMMANDER, STANDARD, MODERN, LEGACY, VINTAGE, PIONEER, PAUPER, DRAFT, OTHER
  description: String (nullable)
  createdAt: Timestamp
  updatedAt: Timestamp
}

CollectionEntry {
  id: UUID
  collectionId: UUID (FK to Collection)
  scryfallId: String (Scryfall card ID)
  quantity: Integer
  condition: Enum
  purchasePrice: Decimal (nullable)
  acquiredDate: Date (nullable)
  notes: String (nullable)
  isCommander: Boolean (default false) // For Commander decks
  isSideboard: Boolean (default false) // For constructed decks
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### Database Selection
**Selected**: PostgreSQL

| Criteria | PostgreSQL |
|----------|------------|
| Scalability | Excellent - handles large collections |
| Relational queries | Full SQL support for complex queries |
| JSON support | JSONB for flexible metadata |
| Production-ready | Industry standard, easy cloud deployment |
| Local development | Docker container for consistent dev environment |

#### Database Schema
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TYPE collection_type AS ENUM ('TRADE_BINDER', 'DECK');
CREATE TYPE deck_type AS ENUM ('COMMANDER', 'STANDARD', 'MODERN', 'LEGACY', 'VINTAGE', 'PIONEER', 'PAUPER', 'DRAFT', 'OTHER');
CREATE TYPE card_condition AS ENUM ('MINT', 'NM', 'LP', 'MP', 'HP', 'DAMAGED');

CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type collection_type NOT NULL,
  deck_type deck_type,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE collection_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  scryfall_id VARCHAR(36) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition card_condition NOT NULL DEFAULT 'NM',
  purchase_price DECIMAL(10, 2),
  acquired_date DATE,
  notes TEXT,
  is_commander BOOLEAN DEFAULT FALSE,
  is_sideboard BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_entries_collection_id ON collection_entries(collection_id);
CREATE INDEX idx_entries_scryfall_id ON collection_entries(scryfall_id);
```

---

### 3. Collections Dashboard
- **Status**: Not Implemented
- **Priority**: High

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| DASH-1 | List all user's collections (trade binders & decks) | Card grid or list view |
| DASH-2 | Show collection type icon/badge | Visual differentiation |
| DASH-3 | Show card count and total value per collection | Summary stats |
| DASH-4 | Create new collection button | Opens create modal |
| DASH-5 | Click collection to open detail view | |
| DASH-6 | Delete/edit collection from dashboard | Context menu or buttons |

---

### 4. Create Collection
- **Status**: Not Implemented
- **Priority**: High

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| CREATE-1 | Modal/page to create new collection | |
| CREATE-2 | Select collection type: Trade Binder or Deck | |
| CREATE-3 | If Deck: select deck type | Commander, Standard, Modern, Legacy, Vintage, Pioneer, Pauper, Draft, Other |
| CREATE-4 | Enter collection name | Required |
| CREATE-5 | Enter description | Optional |
| CREATE-6 | Deck validation hints | e.g., Commander = 100 cards, Standard = 60+ cards |

---

### 5. Collection Detail View
- **Status**: Not Implemented
- **Priority**: High

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| VIEW-1 | Virtualized table displaying cards in collection | Performance for large collections |
| VIEW-2 | Desktop columns: Name, Type, Rarity, Colors, Set/Printing, Purchase Price, Current Price, Condition, Quantity | Current price fetched from Scryfall |
| VIEW-3 | Mobile columns: Name, Type, Quantity | Responsive |
| VIEW-4 | Click row to navigate to card detail | Uses existing CardView |
| VIEW-5 | Show collection summary stats | Total cards, total purchase value, total current value, gain/loss |
| VIEW-6 | Empty state for new collections | Prompt to add cards |
| VIEW-7 | For Commander decks: highlight commander card | Special row styling |
| VIEW-8 | For constructed decks: separate mainboard/sideboard sections | Collapsible sections |

#### UI Components
- Reuse existing RSuite Table with virtualization (as in SetView)
- Add summary header with collection stats
- Navigation link in global navbar

---

### 6. Add Card to Collection
- **Status**: Not Implemented
- **Priority**: High

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| ADD-1 | "Add to Collection" button on CardView | When authenticated |
| ADD-2 | Select which collection to add to | Dropdown of user's collections |
| ADD-3 | Modal/form to enter: quantity, condition, price, notes | |
| ADD-4 | Default quantity to 1 | |
| ADD-5 | Condition dropdown with standard grades | |
| ADD-6 | Price field with USD formatting | Optional |
| ADD-7 | Success feedback on add | Toast notification |
| ADD-8 | If card already in collection, option to add new entry or update existing | |
| ADD-9 | For Commander decks: option to set as commander | Checkbox |
| ADD-10 | For constructed decks: option to add to sideboard | Checkbox |

---

### 8. Current Market Price Display
- **Status**: Not Implemented
- **Priority**: High

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| PRICE-1 | Fetch current USD price from Scryfall for each card | Use existing Scryfall integration |
| PRICE-2 | Display current price alongside purchase price | Side-by-side columns |
| PRICE-3 | Show price difference (gain/loss) per card | Green for gain, red for loss |
| PRICE-4 | Calculate total current value for collection | Sum of (current price × quantity) |
| PRICE-5 | Calculate total gain/loss for collection | Current value - purchase value |
| PRICE-6 | Cache current prices | Refresh on page load, cache for session |
| PRICE-7 | Handle cards without purchase price | Show current price only, exclude from gain/loss |
| PRICE-8 | Support foil vs non-foil pricing | Match to card condition/type in entry |

#### Technical Notes
- Batch fetch prices using Scryfall collection endpoint to minimize API calls
- Respect Scryfall rate limits (100ms between requests)
- Consider background refresh for large collections

---

### 9. Edit/Remove Collection Entry
- **Status**: Not Implemented
- **Priority**: Medium

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| EDIT-1 | Edit button on collection table rows | |
| EDIT-2 | Edit modal with same fields as add | Pre-populated |
| EDIT-3 | Delete entry with confirmation | |
| EDIT-4 | Bulk delete capability | Select multiple rows |
| EDIT-5 | Update quantity inline | Quick +/- buttons |

---

### 10. Collection Search & Filter
- **Status**: Not Implemented
- **Priority**: Medium

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| FILTER-1 | Search by card name | Fuzzy search |
| FILTER-2 | Filter by color | Multi-select |
| FILTER-3 | Filter by rarity | Multi-select |
| FILTER-4 | Filter by set | Dropdown |
| FILTER-5 | Filter by condition | Multi-select |
| FILTER-6 | Sort by any column | Asc/Desc |

---

### 12. Import Collections
- **Status**: Not Implemented
- **Priority**: Medium

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| IMP-1 | Import from Deckbox CSV export | Map Deckbox fields to our schema |
| IMP-2 | Import from Moxfield CSV/JSON export | Map Moxfield fields to our schema |
| IMP-3 | Import from generic CSV | User maps columns to fields |
| IMP-4 | Upload file via drag-and-drop or file picker | |
| IMP-5 | Preview import before confirming | Show parsed cards with any warnings |
| IMP-6 | Match cards to Scryfall IDs | Fuzzy match by name + set code |
| IMP-7 | Handle unmatched cards | Show errors, allow skip or manual match |
| IMP-8 | Import into existing or new collection | User selects destination |
| IMP-9 | Support bulk import (1000+ cards) | Progress indicator |
| IMP-10 | Preserve condition, quantity, purchase price if available | Map from source format |

#### Supported Import Formats

| Source | Format | Key Fields |
|--------|--------|------------|
| Deckbox | CSV | Name, Edition, Quantity, Condition, Price |
| Moxfield | CSV | Name, Set, Collector Number, Quantity, Condition, Purchase Price |
| Generic CSV | CSV | User-defined column mapping |

#### Technical Notes
- Parse CSV on frontend, validate and submit to backend
- Use Scryfall search to resolve card names to IDs
- Queue imports to respect rate limits

---

### 13. Export Collections
- **Status**: Not Implemented
- **Priority**: Low

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| EXP-1 | Export collection to CSV | Standard format |
| EXP-2 | Export in Deckbox-compatible format | For migration |
| EXP-3 | Export in Moxfield-compatible format | For migration |
| EXP-4 | Include all card metadata | Name, set, quantity, condition, prices |

---

### 14. Collection Statistics
- **Status**: Not Implemented  
- **Priority**: Low

#### Requirements
| ID | Requirement | Notes |
|----|-------------|-------|
| STATS-1 | Total cards owned | Sum of quantities |
| STATS-2 | Total collection value | Sum of purchase prices |
| STATS-3 | Breakdown by color | Pie/bar chart |
| STATS-4 | Breakdown by rarity | |
| STATS-5 | Most valuable cards | Top 10 list |

---

## API Endpoints (New)

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | User login | No |
| POST | `/auth/logout` | User logout | Yes |

### Collections
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/collections` | Get all user's collections | Yes |
| POST | `/collections` | Create new collection (trade binder or deck) | Yes |
| GET | `/collections/:id` | Get collection with entries | Yes |
| PUT | `/collections/:id` | Update collection metadata | Yes |
| DELETE | `/collections/:id` | Delete collection and entries | Yes |
| GET | `/collections/:id/stats` | Get collection statistics | Yes |

### Collection Entries
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/collections/:id/entries` | Add card to collection | Yes |
| PUT | `/collections/:id/entries/:entryId` | Update collection entry | Yes |
| DELETE | `/collections/:id/entries/:entryId` | Remove collection entry | Yes |

---

## Technical Architecture Updates

### Database
- PostgreSQL 15+ (Docker for local development)
- Tables: `users`, `collections`, `collection_entries`
- ORM: Knex.js for query building and migrations

### Backend Additions
- Authentication middleware (JWT)
- Collection controller/routes
- User controller/routes
- Database connection layer (e.g., better-sqlite3 or Knex.js)

### Frontend Additions
- Auth context/provider for login state
- Protected route wrapper component
- CollectionView page component
- AddToCollection modal component
- Login/Register pages

---

## Implementation Phases

### Phase 1: Foundation (MVP)
1. Database setup
   - Install dependencies (`knex`, `pg`, `bcrypt`, `jsonwebtoken`)
   - Configure `knexfile.js` (development & production)
   - Create initial migration with schema (users, collections, collection_entries)
   - Docker Compose for local PostgreSQL
2. User authentication (register, login, logout)
3. Collection storage (add, view, delete)
4. Basic collection table view

### Phase 2: Enhanced Management
1. Edit collection entries
2. Search and filter collection
3. Sorting

### Phase 3: Import/Export
1. Import from Deckbox CSV
2. Import from Moxfield CSV
3. Generic CSV import with column mapping
4. Export to CSV (standard, Deckbox, Moxfield formats)

### Phase 4: Polish
1. Collection statistics and charts
2. Bulk operations

---

## Success Metrics
| Metric | Target |
|--------|--------|
| Add card flow completion | < 3 clicks |
| Collection page load time | < 2 seconds for 1000 cards |
| User adoption | 50% of users create collection |

---

## Open Questions
1. ~~Should we support multiple "collections" per user?~~ **Resolved: Yes** - Trade Binder and Decks with deck types
2. ~~Should current market price be fetched and displayed alongside purchase price?~~ **Resolved: Yes** - See section 8
3. ~~Import from other collection tools (Deckbox, Moxfield CSV)?~~ **Resolved: Yes** - See sections 12-13

---

## Dependencies
- Existing Scryfall integration (card data)
- New: PostgreSQL 15+ database
- New: Docker & Docker Compose (local development)
- New: Knex.js (query builder & migrations)
- New: pg (PostgreSQL client for Node.js)
- New: jsonwebtoken (JWT authentication)
- New: bcrypt (password hashing)
- New: Form validation (existing RSuite forms)
