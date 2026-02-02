# Product Requirements Document: MTG Card Loader

## Overview
MTG Card Loader is a web application that allows Magic: The Gathering players to search, browse, and view detailed information about MTG cards and sets using the Scryfall API.

## Problem Statement
MTG players need an easy way to look up card information, check prices, verify format legality, and explore card sets without navigating complex interfaces.

## Target Users
- Magic: The Gathering players (casual and competitive)
- Card collectors checking prices and availability
- Deck builders researching cards and legality

## Core Features

### 1. Home Page
- **Status**: Implemented
- Displays a random MTG card on each visit
- Dark theme UI using RSuite components
- Global navigation bar

### 2. Card Search
- **Status**: Implemented
- Fuzzy search for cards by name (minimum 3 characters)
- Autocomplete dropdown with search results
- Click-to-navigate to card detail view

### 3. Card Detail View
- **Status**: Implemented
- Card name and image display
- Stats: Power, Toughness, Loyalty (where applicable)
- Pricing: USD and USD Foil prices
- Set information
- Format legality (Commander, Standard)
- Oracle text / abilities
- Purchase links (TCGPlayer, CardMarket)
- Responsive layout (mobile/desktop)

### 4. Set Search
- **Status**: Implemented
- Fuzzy search for sets by name
- Filters to expansion, masters, and core sets
- Click-to-navigate to set detail view

### 5. Set Detail View
- **Status**: Implemented
- Virtualized table of all cards in set
- Columns: Name, Type, Rarity, Colors, Set (desktop)
- Columns: Name, Type (mobile)
- Click row to view card details

## Technical Architecture

### Frontend
- **Framework**: React 17 (class and functional components)
- **UI Library**: RSuite 5
- **Routing**: React Router DOM v6
- **HTTP Client**: Fetch API / Redaxios
- **Build Tool**: Webpack + react-app-rewired
- **Styling**: LESS, CSS

### Backend
- **Framework**: Express.js
- **Port**: 5000
- **External API**: Scryfall SDK
- **Fuzzy Search**: Fuzzysort

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cards/random` | Get a random card |
| GET | `/cards/:id` | Get card by ID |
| GET | `/cards/search/:query` | Search cards by name |
| GET | `/cards?name=&page=` | Paginated card search |
| GET | `/sets` | Get all sets |
| GET | `/sets/:id` | Get set by ID with cards |
| GET | `/sets/search/:query` | Search sets by name |

## Future Enhancements (TODO)

### High Priority
1. **Table Sorting** - Enable sort for name, type, rarity, and color in SetView
2. **Error Handling** - Add proper error states and loading indicators
3. **Deck Builder** - Allow users to create and save decks

### Medium Priority
4. **User Authentication** - Save favorite cards and decks
5. **Advanced Search** - Filter by color, mana cost, type, format
6. **Card Comparison** - Compare multiple cards side-by-side
7. **Price History** - Track card price changes over time

### Low Priority
8. **Collection Tracker** - Manage owned cards
9. **Trade Lists** - Create want/have lists
10. **Offline Support** - PWA with cached data

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Mobile Support | Responsive design |
| Theme | Dark mode (default) |
| API Rate Limiting | Respect Scryfall limits |
| Browser Support | Modern browsers (Chrome, Firefox, Safari) |

## Dependencies
- Node.js (LTS)
- Yarn package manager
- Scryfall API (external, no auth required)
