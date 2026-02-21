import React from 'react';
import { SelectPicker } from 'rsuite';

export const CONDITION_OPTIONS = [
  { label: 'Mint', value: 'MINT' },
  { label: 'Near Mint', value: 'NM' },
  { label: 'Lightly Played', value: 'LP' },
  { label: 'Moderately Played', value: 'MP' },
  { label: 'Heavily Played', value: 'HP' },
  { label: 'Damaged', value: 'DAMAGED' },
];

export const FINISH_OPTIONS = [
  { label: 'Non-Foil', value: 'nonfoil' },
  { label: 'Foil', value: 'foil' },
  { label: 'Etched', value: 'etched' },
];

export const ConditionSelector = ({ value, onChange, ...rest }) => (
  <SelectPicker
    data={CONDITION_OPTIONS}
    value={value}
    onChange={onChange}
    searchable={false}
    block
    placeholder="Select condition"
    {...rest}
  />
);

export const FinishSelector = ({ value, onChange, ...rest }) => (
  <SelectPicker
    data={FINISH_OPTIONS}
    value={value}
    onChange={onChange}
    searchable={false}
    block
    placeholder="Select finish"
    {...rest}
  />
);
