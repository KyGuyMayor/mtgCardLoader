/**
 * Drag-and-drop card identification helper module.
 * Extracts card identity (Scryfall ID or card name) from HTML5 drag-and-drop data,
 * and provides async function to resolve full card data from Scryfall.
 * 
 * @module dragDropCardParser
 */

/**
 * Parses drag-and-drop dataTransfer to extract card identity information.
 * 
 * Attempts to extract:
 * 1. Scryfall UUID from URLs in text/uri-list or text/plain (cards.scryfall.io pattern)
 * 2. Card name from text/html by parsing img alt attribute
 * 3. Falls back to text/plain as raw card name
 * 
 * @param {DataTransfer} dataTransfer - The drag event's dataTransfer object
 * @returns {Object|null} - { scryfallId, cardName, imageUrl } or null if no card data found
 * @throws {Error} - Never throws; returns null on any parsing error
 */
export function parseDropData(dataTransfer) {
  try {
    const types = Array.from(dataTransfer.types || []);
    
    let scryfallId = null;
    let cardName = null;
    let imageUrl = null;

    // Try to extract Scryfall UUID from URI list or plain text URLs
    if (types.includes('text/uri-list') || types.includes('text/plain')) {
      const textUri = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
      if (textUri) {
        const uuidMatch = textUri.match(/cards\.scryfall\.io\/.*\/([a-f0-9-]{36})\.[a-z]+$/i);
        if (uuidMatch) {
          scryfallId = uuidMatch[1];
          imageUrl = textUri;
        }
      }
    }

    // Try to extract card name from HTML (img alt attribute) using DOMParser
    if (types.includes('text/html') && !scryfallId) {
      const html = dataTransfer.getData('text/html');
      if (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const img = doc.querySelector('img');
        if (img) {
          const alt = img.getAttribute('alt');
          if (alt) {
            cardName = alt;
          }
          const src = img.getAttribute('src');
          if (src) {
            imageUrl = src;
            const imgUuidMatch = src.match(/cards\.scryfall\.io\/.*\/([a-f0-9-]{36})\.[a-z]+$/i);
            if (imgUuidMatch) {
              scryfallId = imgUuidMatch[1];
            }
          }
        }
      }
    }

    // Fall back to text/plain as raw card name
    if (!cardName && !scryfallId && types.includes('text/plain')) {
      const plainText = dataTransfer.getData('text/plain');
      if (plainText && plainText.trim()) {
        cardName = plainText.trim();
      }
    }

    // Return null if we found nothing useful
    if (!scryfallId && !cardName) {
      return null;
    }

    return {
      scryfallId: scryfallId || null,
      cardName: cardName || null,
      imageUrl: imageUrl || null,
    };
  } catch (error) {
    // Silently fail on any parsing error
    console.error('[dragDropCardParser] Error parsing drop data:', error);
    return null;
  }
}

/**
 * Resolves full card data from Scryfall based on parsed drop data.
 * 
 * Strategy:
 * - If scryfallId is available, fetch from /cards/:id
 * - Else if cardName is available, fetch from /cards/named?exact=<name>
 * - Otherwise returns null
 * 
 * @param {DataTransfer} dataTransfer - The drag event's dataTransfer object
 * @returns {Promise<Object|null>} - Full Scryfall card object or null if lookup fails
 */
export async function resolveCardFromDrop(dataTransfer) {
  try {
    const parsed = parseDropData(dataTransfer);
    if (!parsed) {
      return null;
    }

    // If we have a Scryfall ID, fetch the full card data
    if (parsed.scryfallId) {
      const response = await fetch(`/cards/${encodeURIComponent(parsed.scryfallId)}`);
      if (response.ok) {
        return await response.json();
      }
    }

    // If we have a card name, try exact match via /cards/named
    if (parsed.cardName) {
      const response = await fetch(`/cards/named?exact=${encodeURIComponent(parsed.cardName)}`);
      if (response.ok) {
        return await response.json();
      }

      // If exact match fails, try fuzzy match as fallback
      const fuzzyResponse = await fetch(`/cards/named?fuzzy=${encodeURIComponent(parsed.cardName)}`);
      if (fuzzyResponse.ok) {
        return await fuzzyResponse.json();
      }
    }

    return null;
  } catch (error) {
    console.error('[dragDropCardParser] Error resolving card from drop:', error);
    return null;
  }
}
