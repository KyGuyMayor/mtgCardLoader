import React from 'react';
import { Table } from 'rsuite';
import authFetch from './authFetch';

const { Cell } = Table;

/** Scryfall collection API batch size limit. */
export const SCRYFALL_CHUNK_SIZE = 75;

/** Delay between Scryfall API chunks (ms). */
export const SCRYFALL_DELAY_MS = 100;

/** Max entries per bulk import request. */
export const BULK_CHUNK_SIZE = 500;

/** Delay between bulk import chunks (ms). */
export const BULK_DELAY_MS = 50;

/** Toast display duration (ms). */
export const TOAST_DURATION = 4000;

/** Status color map for import card statuses. */
export const STATUS_COLORS = {
  pending: '#888',
  matched: '#2ecc71',
  unmatched: '#e74c3c',
  skipped: '#f39c12',
};

/**
 * Shared StatusCell component for import preview tables.
 */
export const StatusCell = ({ rowData, ...props }) => (
  <Cell {...props}>
    <span style={{ color: STATUS_COLORS[rowData.status] || '#888' }}>
      {rowData.status === 'matched' ? '✓ Matched' :
       rowData.status === 'unmatched' ? '✗ Not Found' :
       rowData.status === 'skipped' ? '— Skipped' : '…'}
    </span>
  </Cell>
);

/**
 * Extract the front face name from a potentially double-sided card name.
 * e.g., "Delver of Secrets // Insectile Aberration" → "Delver of Secrets"
 */
export function getFrontFaceName(name) {
  return name.includes(' // ') ? name.split(' // ')[0] : name;
}

/**
 * Build a lookup map from Scryfall collection API response data.
 * Indexes cards by lowercase name, individual face names for DFCs,
 * and set|collector_number for precise matching.
 *
 * @param {Array} cards - Array of Scryfall card objects
 * @returns {Object} Map of lookup keys to card objects
 */
export function buildScryfallFoundMap(cards) {
  const foundMap = {};
  cards.forEach((card) => {
    const key = card.name.toLowerCase();
    if (!foundMap[key]) foundMap[key] = card;

    // Index by set+collector for precise matching
    if (card.set && card.collector_number) {
      const setKey = `${card.set}|${card.collector_number}`;
      if (!foundMap[setKey]) foundMap[setKey] = card;
    }

    // For double-sided cards, also index by individual face names
    if (card.name.includes(' // ')) {
      const faces = card.name.split(' // ');
      faces.forEach((face) => {
        const faceKey = face.toLowerCase();
        if (!foundMap[faceKey]) foundMap[faceKey] = card;
      });
    }
  });
  return foundMap;
}

/**
 * Bulk import aggregated entries to a collection in chunks.
 *
 * @param {string} collectionId - Target collection ID
 * @param {Array} aggregatedEntries - Entries to import (already aggregated)
 * @returns {{ imported: number, failed: number }}
 */
export async function bulkImportEntries(collectionId, aggregatedEntries) {
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < aggregatedEntries.length; i += BULK_CHUNK_SIZE) {
    const chunk = aggregatedEntries.slice(i, i + BULK_CHUNK_SIZE);

    try {
      const res = await authFetch(`/collections/${collectionId}/entries/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: chunk }),
      });

      if (res.ok || res.status === 201) {
        const data = await res.json();
        imported += data.imported || chunk.length;
      } else {
        failed += chunk.length;
      }
    } catch (err) {
      failed += chunk.length;
    }

    if (i + BULK_CHUNK_SIZE < aggregatedEntries.length) {
      await new Promise((r) => setTimeout(r, BULK_DELAY_MS));
    }
  }

  return { imported, failed };
}
