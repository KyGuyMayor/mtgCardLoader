import React from 'react';
import { CheckboxGroup, Checkbox, FlexboxGrid, Input, Button, CheckPicker } from 'rsuite';
import { COLOR_OPTIONS, RARITY_OPTIONS, TYPE_OPTIONS } from '../../helpers/filterConstants';
import useDebouncedSearch from '../../helpers/useDebouncedSearch';

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
  const [searchInput, setSearchInput] = useDebouncedSearch(nameSearch, setNameSearch);

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
