import React from 'react';
import { CheckPicker, Input, Button, FlexboxGrid } from 'rsuite';
import { COLOR_OPTIONS, RARITY_OPTIONS, CONDITION_OPTIONS } from '../../helpers/filterConstants';
import useDebouncedSearch from '../../helpers/useDebouncedSearch';

const CollectionFilters = ({
  nameSearch,
  setNameSearch,
  colorFilter,
  setColorFilter,
  rarityFilter,
  setRarityFilter,
  conditionFilter,
  setConditionFilter,
  onClearFilters,
  totalCount,
  filteredCount,
}) => {
  const [searchInput, setSearchInput] = useDebouncedSearch(nameSearch, setNameSearch);

  const hasActiveFilters =
    nameSearch ||
    colorFilter.length > 0 ||
    rarityFilter.length > 0 ||
    conditionFilter.length > 0;

  return (
    <FlexboxGrid
      style={{
        padding: '10px 0',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <FlexboxGrid.Item>
        <Input
          placeholder="Search by name..."
          value={searchInput}
          onChange={setSearchInput}
          style={{ width: 200 }}
        />
      </FlexboxGrid.Item>
      <FlexboxGrid.Item>
        <CheckPicker
          data={COLOR_OPTIONS}
          value={colorFilter}
          onChange={setColorFilter}
          placeholder="Colors"
          style={{ width: 160 }}
          searchable={false}
        />
      </FlexboxGrid.Item>
      <FlexboxGrid.Item>
        <CheckPicker
          data={RARITY_OPTIONS}
          value={rarityFilter}
          onChange={setRarityFilter}
          placeholder="Rarity"
          style={{ width: 160 }}
          searchable={false}
        />
      </FlexboxGrid.Item>
      <FlexboxGrid.Item>
        <CheckPicker
          data={CONDITION_OPTIONS}
          value={conditionFilter}
          onChange={setConditionFilter}
          placeholder="Condition"
          style={{ width: 170 }}
          searchable={false}
        />
      </FlexboxGrid.Item>
      {hasActiveFilters && (
        <FlexboxGrid.Item>
          <Button appearance="ghost" onClick={onClearFilters} size="sm">
            Clear Filters
          </Button>
        </FlexboxGrid.Item>
      )}
      {hasActiveFilters && (
        <FlexboxGrid.Item>
          <span style={{ color: '#aaa', fontSize: 13 }}>
            Showing {filteredCount} of {totalCount}
          </span>
        </FlexboxGrid.Item>
      )}
    </FlexboxGrid>
  );
};

export default CollectionFilters;
