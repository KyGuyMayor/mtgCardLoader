/**
 * Plain text decklist parser module.
 * Parses MTGA, Moxfield, and Archidekt export formats into structured card data.
 *
 * Supports:
 * - Basic format: "1 Sol Ring"
 * - Set + collector number: "1 Sol Ring (C21) 263"
 * - Foil indicator: "1 Sol Ring (C21) 263 *F*"
 * - Archidekt 'x' prefix: "1x Sol Ring"
 * - Archidekt category/label suffixes: "[Category] ^Label^"
 * - Section headers: Commander, Companion, Deck, Sideboard, Maybeboard, Considering
 * - Double-sided card names with ' // '
 * - Card names with commas
 *
 * This module uses CommonJS (module.exports) for compatibility with both:
 * - Backend Node.js controllers (require statements)
 * - Frontend React components via Webpack (import statements)
 * Webpack + Babel automatically handles CommonJS ↔ ES6 module interop.
 *
 * @module decklistParser
 */

/** Section headers recognized on their own line (case-insensitive). */
const SECTION_HEADERS = ['commander', 'companion', 'deck', 'mainboard', 'sideboard', 'maybeboard', 'considering'];

/** Map section header names to canonical section values. */
const SECTION_MAP = {
  commander: 'Commander',
  companion: 'Companion',
  deck: 'Deck',
  mainboard: 'Deck',
  sideboard: 'Sideboard',
  maybeboard: 'Maybeboard',
  considering: 'Maybeboard',
};

/** Default section for cards before any header or after 'Deck' header. */
const DEFAULT_SECTION = 'Deck';

/** Foil marker string. */
const FOIL_MARKER = '*F*';

/** UTF-8 BOM character. */
const UTF8_BOM = '\uFEFF';

/**
 * Regex to strip Archidekt category and label suffixes.
 * Matches [Category] and ^Label^ (with optional trailing comma/caret) at end of line.
 */
const ARCHIDEKT_SUFFIX_RE = /\s*(?:\[[^\]]*\]|\^[^^]*\^,?\^?)[\s^]*$/;

/**
 * Regex to match a section header line (standalone word, optional trailing whitespace).
 */
const SECTION_HEADER_RE = new RegExp(
  '^(' + SECTION_HEADERS.join('|') + ')\\s*$', 'i'
);

/**
 * Regex to match a card line.
 * Groups: (1) quantity, (2) card name, (3) set code, (4) collector number
 */
const CARD_LINE_RE = /^(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9]{2,6})\)(?:\s+(\S+))?)?$/;

/**
 * Regex for isDecklistText detection — matches lines starting with a quantity + name.
 */
const CARD_DETECT_RE = /^\d+x?\s+\S/;

/** Minimum number of card-like lines to consider text a decklist. */
const MIN_CARD_LINES_FOR_DETECTION = 2;

/**
 * Strips Archidekt suffixes ([Category] and ^Label^) and the foil marker from a line,
 * returning the cleaned line and whether foil was found.
 *
 * @param {string} line
 * @returns {{ cleaned: string, foil: boolean }}
 */
function stripSuffixes(line) {
  // Repeatedly strip Archidekt suffixes from the end
  let cleaned = line;
  let prev;
  do {
    prev = cleaned;
    cleaned = cleaned.replace(ARCHIDEKT_SUFFIX_RE, '');
  } while (cleaned !== prev);

  // Check and strip foil marker
  let foil = false;
  const foilIdx = cleaned.lastIndexOf(FOIL_MARKER);
  if (foilIdx !== -1) {
    foil = true;
    cleaned = (cleaned.slice(0, foilIdx) + cleaned.slice(foilIdx + FOIL_MARKER.length)).trim();
  }

  return { cleaned: cleaned.trim(), foil };
}

/**
 * Parses a plain text decklist into structured sections and cards.
 *
 * @param {string} text - The raw decklist text
 * @returns {{ sections: Array<{name: string, cards: Array}>, allCards: Array<{name: string, quantity: number, set: string|null, collectorNumber: string|null, foil: boolean, section: string}> }}
 */
function parseDecklistText(text) {
  if (!text || typeof text !== 'string') {
    return { sections: [], allCards: [] };
  }

  // Strip UTF-8 BOM
  const cleaned = text.replace(new RegExp('^' + UTF8_BOM), '');
  const lines = cleaned.split(/\r?\n/);

  const sectionMap = {}; // name -> cards array
  const allCards = [];
  let currentSection = DEFAULT_SECTION;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip blank lines
    if (line === '') continue;

    // Skip comment lines
    if (line.startsWith('//')) continue;

    // Check for section header
    const headerMatch = line.match(SECTION_HEADER_RE);
    if (headerMatch) {
      currentSection = SECTION_MAP[headerMatch[1].toLowerCase()];
      continue;
    }

    // Strip Archidekt suffixes and foil marker
    const { cleaned: strippedLine, foil } = stripSuffixes(line);

    // Try to match card line
    const cardMatch = strippedLine.match(CARD_LINE_RE);
    if (!cardMatch) continue;

    const quantity = parseInt(cardMatch[1], 10);
    const name = cardMatch[2].trim();
    const set = cardMatch[3] ? cardMatch[3].toLowerCase() : null;
    const collectorNumber = cardMatch[4] || null;

    const card = {
      name,
      quantity,
      set,
      collectorNumber,
      foil,
      section: currentSection,
    };

    allCards.push(card);

    if (!sectionMap[currentSection]) {
      sectionMap[currentSection] = [];
    }
    sectionMap[currentSection].push(card);
  }

  // Build ordered sections array (preserve insertion order)
  const sections = Object.keys(sectionMap).map(name => ({
    name,
    cards: sectionMap[name],
  }));

  return { sections, allCards };
}

/**
 * Detects whether text appears to be a plain text decklist (vs CSV or other format).
 * Returns true if the text contains at least a few lines matching the quantity+name pattern.
 *
 * @param {string} text - The text to check
 * @returns {boolean}
 */
function isDecklistText(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const cleaned = text.replace(new RegExp('^' + UTF8_BOM), '');
  const lines = cleaned.split(/\r?\n/);

  let cardLineCount = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('//')) continue;
    if (CARD_DETECT_RE.test(line)) {
      cardLineCount++;
      if (cardLineCount >= MIN_CARD_LINES_FOR_DETECTION) {
        return true;
      }
    }
  }

  return false;
}

module.exports = { parseDecklistText, isDecklistText };
