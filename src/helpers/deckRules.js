/**
 * Deck format rules configuration module.
 * Single source of truth for all MTG deck format construction rules.
 * 
 * This module uses CommonJS (module.exports) for compatibility with both:
 * - Backend Node.js controllers (require statements)
 * - Frontend React components via Webpack (import statements)
 * Webpack + Babel automatically handles CommonJS ↔ ES6 module interop.
 * 
 * @module deckRules
 */

/**
 * Format rules keyed by deck_type enum values.
 * Each format defines: min/max deck size, copy limits, sideboard size, basic land exemption,
 * singleton rule, commander requirement, and Scryfall legality key.
 */
const DECK_FORMAT_RULES = {
  STANDARD: {
    name: 'Standard',
    minDeckSize: 60,
    maxDeckSize: null,
    maxCopies: 4,
    basicLandExempt: true,
    sideboardSize: 15,
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: 'standard',
  },
  PLANAR_STANDARD: {
    name: 'Planar Standard',
    minDeckSize: 60,
    maxDeckSize: null,
    maxCopies: 4,
    basicLandExempt: true,
    sideboardSize: 15,
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: null,
    legalSets: ['ecl', 'eoe', 'tdm', 'dft', 'fdn'],
    legalSetNames: {
      ecl: 'Lorwyn Eclipsed',
      eoe: 'Edge of Eternities',
      tdm: 'Tarkir: Dragonstorm',
      dft: 'Aetherdrift',
      fdn: 'Foundations',
    },
    bannedCards: ['Cori-steel Cutter'],
    description: 'Community format using Universe Within sets from the last two years plus Foundations. Excludes Universes Beyond sets.',
    rotationNote: 'Rotates with each new Universe Within Standard release. Foundations is always legal.',
  },
  MODERN: {
    name: 'Modern',
    minDeckSize: 60,
    maxDeckSize: null,
    maxCopies: 4,
    basicLandExempt: true,
    sideboardSize: 15,
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: 'modern',
  },
  LEGACY: {
    name: 'Legacy',
    minDeckSize: 60,
    maxDeckSize: null,
    maxCopies: 4,
    basicLandExempt: true,
    sideboardSize: 15,
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: 'legacy',
  },
  VINTAGE: {
    name: 'Vintage',
    minDeckSize: 60,
    maxDeckSize: null,
    maxCopies: 4,
    basicLandExempt: true,
    sideboardSize: 15,
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: 'vintage',
  },
  PIONEER: {
    name: 'Pioneer',
    minDeckSize: 60,
    maxDeckSize: null,
    maxCopies: 4,
    basicLandExempt: true,
    sideboardSize: 15,
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: 'pioneer',
  },
  PAUPER: {
    name: 'Pauper',
    minDeckSize: 60,
    maxDeckSize: null,
    maxCopies: 4,
    basicLandExempt: true,
    sideboardSize: 15,
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: 'pauper',
  },
  COMMANDER: {
    name: 'Commander',
    minDeckSize: 100,
    maxDeckSize: 100,
    maxCopies: 1,
    basicLandExempt: true,
    sideboardSize: 0,
    singleton: true,
    requiresCommander: true,
    scryfallLegalityKey: 'commander',
  },
  DRAFT: {
    name: 'Draft',
    minDeckSize: 40,
    maxDeckSize: null,
    maxCopies: null, // unlimited
    basicLandExempt: true,
    sideboardSize: null, // unlimited
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: null, // no legality check
  },
  OTHER: {
    name: 'Other',
    minDeckSize: null,
    maxDeckSize: null,
    maxCopies: null,
    basicLandExempt: false,
    sideboardSize: null,
    singleton: false,
    requiresCommander: false,
    scryfallLegalityKey: null,
  },
};

/**
 * Basic lands in Magic: The Gathering, including snow-covered variants.
 * These are exempt from copy limit rules in formats with basicLandExempt: true.
 */
const BASIC_LANDS = [
  'Plains',
  'Island',
  'Swamp',
  'Mountain',
  'Forest',
  'Wastes',
];

/**
 * Checks if a card name is a basic land.
 * Returns true for Plains, Island, Swamp, Mountain, Forest, Wastes, and their Snow-Covered variants.
 * 
 * @param {string} cardName - The card name to check
 * @returns {boolean} - True if the card is a basic land
 * @example
 * isBasicLand('Plains') // true
 * isBasicLand('Snow-Covered Island') // true
 * isBasicLand('Lightning Bolt') // false
 */
function isBasicLand(cardName) {
  if (!cardName || typeof cardName !== 'string') {
    return false;
  }

  // Check exact match first (faster)
  if (BASIC_LANDS.includes(cardName)) {
    return true;
  }

  // Check for Snow-Covered variants
  if (cardName.startsWith('Snow-Covered ')) {
    const baseName = cardName.replace('Snow-Covered ', '');
    return BASIC_LANDS.includes(baseName);
  }

  return false;
}

module.exports = {
  DECK_FORMAT_RULES,
  isBasicLand,
};
