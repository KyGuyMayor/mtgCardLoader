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
    commanderLabel: 'Commander',
    maxCommanders: 2,
    scryfallLegalityKey: 'commander',
  },
  OATHBREAKER: {
    name: 'Oathbreaker',
    minDeckSize: 60,
    maxDeckSize: 60,
    maxCopies: 1,
    basicLandExempt: true,
    sideboardSize: 0,
    singleton: true,
    requiresCommander: true,
    commanderLabel: 'Oathbreaker',
    commanderType: 'planeswalker',
    maxCommanders: 1,
    requiresSignatureSpell: true,
    scryfallLegalityKey: 'oathbreaker',
    description: 'Multiplayer singleton format with a Planeswalker Oathbreaker and a Signature Spell in the command zone.',
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

/**
 * Checks if two commander cards have compatible partner abilities.
 * Supports: Partner, Partner with [Name], Friends forever,
 * Choose a Background + Background, Doctor's companion + Time Lord.
 *
 * @param {object} card1 - First commander card (Scryfall card object)
 * @param {object} card2 - Second commander card (Scryfall card object)
 * @returns {boolean} - True if the two cards can legally share the command zone
 */
function arePartnersCompatible(card1, card2) {
  const text1 = (card1.oracle_text || '').toLowerCase();
  const text2 = (card2.oracle_text || '').toLowerCase();
  const type1 = card1.type_line || '';
  const type2 = card2.type_line || '';

  // Generic "Partner" — both must have the keyword (but NOT "Partner with")
  const hasGenericPartner = (text) =>
    /\bpartner\b/.test(text) && !/\bpartner with\b/.test(text);
  if (hasGenericPartner(text1) && hasGenericPartner(text2)) return true;

  // "Partner with [Name]" — each card names the other
  const getPartnerWithName = (text) => {
    const match = text.match(/partner with ([^\n(]+)/);
    return match ? match[1].trim() : null;
  };
  const pw1 = getPartnerWithName(text1);
  const pw2 = getPartnerWithName(text2);
  if (pw1 && pw1 === card2.name.toLowerCase()) return true;
  if (pw2 && pw2 === card1.name.toLowerCase()) return true;

  // "Friends forever" — both must have the keyword
  if (text1.includes('friends forever') && text2.includes('friends forever')) return true;

  // "Choose a Background" + Background enchantment
  if (text1.includes('choose a background') && type2.includes('Background')) return true;
  if (text2.includes('choose a background') && type1.includes('Background')) return true;

  // "Doctor's companion" + Time Lord Doctor
  if (text1.includes("doctor's companion") && type2.includes('Time Lord')) return true;
  if (text2.includes("doctor's companion") && type1.includes('Time Lord')) return true;

  return false;
}

module.exports = {
  DECK_FORMAT_RULES,
  isBasicLand,
  arePartnersCompatible,
};
