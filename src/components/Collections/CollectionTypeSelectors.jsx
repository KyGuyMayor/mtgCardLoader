import React from 'react';
import { SelectPicker } from 'rsuite';

export const TYPE_OPTIONS = [
  { label: 'Trade Binder', value: 'TRADE_BINDER' },
  { label: 'Deck', value: 'DECK' },
];

export const DECK_TYPE_OPTIONS = [
  { label: 'Commander', value: 'COMMANDER' },
  { label: 'Standard', value: 'STANDARD' },
  { label: 'Modern', value: 'MODERN' },
  { label: 'Legacy', value: 'LEGACY' },
  { label: 'Vintage', value: 'VINTAGE' },
  { label: 'Pioneer', value: 'PIONEER' },
  { label: 'Pauper', value: 'PAUPER' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Planar Standard', value: 'PLANAR_STANDARD' },
  { label: 'Other', value: 'OTHER' },
];

/**
 * Reusable collection type selector (Trade Binder / Deck)
 * @param {string} value - Selected type value
 * @param {function} onChange - Callback when selection changes
 * @param {object} props - Additional RSuite SelectPicker props
 */
export const CollectionTypeSelector = ({ value, onChange, ...props }) => (
  <SelectPicker
    data={TYPE_OPTIONS}
    value={value}
    onChange={onChange}
    searchable={false}
    block
    placeholder="Select type"
    {...props}
  />
);

/**
 * Reusable deck type selector (Commander, Standard, Modern, etc.)
 * @param {string} value - Selected deck type value
 * @param {function} onChange - Callback when selection changes
 * @param {object} props - Additional RSuite SelectPicker props
 */
export const DeckTypeSelector = ({ value, onChange, ...props }) => (
  <SelectPicker
    data={DECK_TYPE_OPTIONS}
    value={value}
    onChange={onChange}
    searchable={false}
    block
    placeholder="Select deck type"
    {...props}
  />
);
