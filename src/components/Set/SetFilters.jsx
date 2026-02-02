import React, { useState, useEffect } from 'react';
import { CheckboxGroup, Checkbox, FlexboxGrid, Input, Button, CheckPicker } from 'rsuite';

const COLOR_OPTIONS = [
  { value: 'W', label: 'White' },
  { value: 'U', label: 'Blue' },
  { value: 'B', label: 'Black' },
  { value: 'R', label: 'Red' },
  { value: 'G', label: 'Green' },
  { value: 'C', label: 'Colorless' },
  { value: 'M', label: 'Multicolor' }
];

const RARITY_OPTIONS = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'mythic', label: 'Mythic' }
];

const TYPE_OPTIONS = [
  { value: 'Creature', label: 'Creature' },
  { value: 'Instant', label: 'Instant' },
  { value: 'Sorcery', label: 'Sorcery' },
  { value: 'Enchantment', label: 'Enchantment' },
  { value: 'Artifact', label: 'Artifact' },
  { value: 'Land', label: 'Land' },
  { value: 'Planeswalker', label: 'Planeswalker' }
];

const SetFilters = ({
  nameSearch,
  setNameSearch,
  colorFilter,
  setColorFilter,
  rarityFilter,
  setRarityFilter,
  typeFilter,
  setTypeFilter,
  onClearFilters,
  totalCards,
  filteredCount
}) => {
  const [searchInput, setSearchInput] = useState(nameSearch);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNameSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setNameSearch]);

  useEffect(() => {
    setSearchInput(nameSearch);
  }, [nameSearch]);

  const hasActiveFilters = nameSearch || colorFilter.length > 0 || rarityFilter.length > 0 || typeFilter.length > 0;

  return (
    <FlexboxGrid style={{ padding: '10px 20px', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
      <FlexboxGrid.Item>
        <Input
          placeholder="Search by name..."
          value={searchInput}
          onChange={setSearchInput}
          style={{ width: 200 }}
        />
      </FlexboxGrid.Item>
      <FlexboxGrid.Item>
        <span style={{ marginRight: '10px', color: '#aaa' }}>Colors:</span>
        <CheckboxGroup
          inline
          name="colorFilter"
          value={colorFilter}
          onChange={setColorFilter}
        >
          {COLOR_OPTIONS.map(opt => (
            <Checkbox key={opt.value} value={opt.value}>{opt.label}</Checkbox>
          ))}
        </CheckboxGroup>
      </FlexboxGrid.Item>
      <FlexboxGrid.Item>
        <span style={{ marginRight: '10px', color: '#aaa' }}>Rarity:</span>
        <CheckboxGroup
          inline
          name="rarityFilter"
          value={rarityFilter}
          onChange={setRarityFilter}
        >
          {RARITY_OPTIONS.map(opt => (
            <Checkbox key={opt.value} value={opt.value}>{opt.label}</Checkbox>
          ))}
        </CheckboxGroup>
      </FlexboxGrid.Item>
      <FlexboxGrid.Item>
        <span style={{ marginRight: '10px', color: '#aaa' }}>Type:</span>
        <CheckPicker
          data={TYPE_OPTIONS}
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="Select types"
          style={{ width: 200 }}
          searchable={false}
        />
      </FlexboxGrid.Item>
      {hasActiveFilters && (
        <FlexboxGrid.Item>
          <Button appearance="ghost" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </FlexboxGrid.Item>
      )}
      <FlexboxGrid.Item>
        <span style={{ color: '#aaa' }}>
          Showing {filteredCount} of {totalCards} cards
        </span>
      </FlexboxGrid.Item>
    </FlexboxGrid>
  );
};

export default SetFilters;
