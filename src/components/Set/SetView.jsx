import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import {
  CustomProvider,
  Container,
  Content,
  Table
} from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';
import SetFilters from './SetFilters';

const { Column, HeaderCell, Cell } = Table;

const RARITY_ORDER = {
  'common': 0,
  'uncommon': 1,
  'rare': 2,
  'mythic': 3
};

const SetView = () => {
  const {id} = useParams();
  const navigate = useNavigate();
  const [set, setSet] =  useState([]);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortType, setSortType] = useState(null);
  const [nameSearch, setNameSearch] = useState('');
  const [colorFilter, setColorFilter] = useState([]);
  const [rarityFilter, setRarityFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);

  const defaultColumns = [
    {
      key: 'name',
      label: 'Name',
      fixed: true,
      flexGrow: 1,
      sortable: true
    },
    {
      key: 'type_line',
      label: 'Type',
      flexGrow: 1,
      sortable: true
    },
  ];
  
  const desktopColumns = [
    {
      key: 'rarity',
      label: 'Rarity',
      flexGrow: 1,
      sortable: true
    },
    {
      key: 'colors',
      label: 'Colors',
      flexGrow: 1,
      sortable: false
    },
    {
      key: 'set_name',
      label: 'Set',
      flexGrow: 1,
      sortable: false 
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const setData  = await fetch(`/sets/${id}`);
      const setJSON = await setData.json();
      let cards = setJSON.cards;

      setSet(cards);
    } 
     
    fetchData();
  }, [id]);

  const handleSortColumn = (dataKey, newSortType) => {
    if (sortColumn === dataKey) {
      if (sortType === 'asc') {
        setSortType('desc');
      } else if (sortType === 'desc') {
        setSortColumn(null);
        setSortType(null);
      } else {
        setSortType('asc');
      }
    } else {
      setSortColumn(dataKey);
      setSortType('asc');
    }
  };

  const filteredData = useMemo(() => {
    let result = set;

    if (nameSearch) {
      const searchLower = nameSearch.toLowerCase();
      result = result.filter(card => 
        card.name?.toLowerCase().includes(searchLower)
      );
    }

    if (colorFilter.length > 0) {
      result = result.filter(card => {
        const cardColors = card.colors || [];
        const isColorless = cardColors.length === 0;
        const isMulticolor = cardColors.length > 1;

        if (colorFilter.includes('C') && isColorless) return true;
        if (colorFilter.includes('M') && isMulticolor) return true;
        return colorFilter.some(c => c !== 'C' && c !== 'M' && cardColors.includes(c));
      });
    }

    if (rarityFilter.length > 0) {
      result = result.filter(card => 
        rarityFilter.includes(card.rarity?.toLowerCase())
      );
    }

    if (typeFilter.length > 0) {
      result = result.filter(card => 
        typeFilter.some(type => card.type_line?.includes(type))
      );
    }

    return result;
  }, [set, nameSearch, colorFilter, rarityFilter, typeFilter]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortType) {
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn] || '';
      const bValue = b[sortColumn] || '';

      if (sortColumn === 'rarity') {
        const aRank = RARITY_ORDER[aValue.toLowerCase()] ?? 99;
        const bRank = RARITY_ORDER[bValue.toLowerCase()] ?? 99;
        return sortType === 'asc' ? aRank - bRank : bRank - aRank;
      }

      if (sortType === 'asc') {
        return aValue.localeCompare(bValue);
      }
      return bValue.localeCompare(aValue);
    });
  }, [filteredData, sortColumn, sortType]);

  const handleClick = (rowObject) => {
    navigate(`/cardsearch/${rowObject.id}`);
  }

  const handleClearFilters = () => {
    setNameSearch('');
    setColorFilter([]);
    setRarityFilter([]);
    setTypeFilter([]);
    setSortColumn(null);
    setSortType(null);
  };

  const columns = isMobile ? defaultColumns : defaultColumns.concat(desktopColumns);

  return (
    <CustomProvider theme="dark">
      <Container>
        <NavigationBar />
        <Content>
          <SetFilters
            nameSearch={nameSearch}
            setNameSearch={setNameSearch}
            colorFilter={colorFilter}
            setColorFilter={setColorFilter}
            rarityFilter={rarityFilter}
            setRarityFilter={setRarityFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            onClearFilters={handleClearFilters}
            totalCards={set.length}
            filteredCount={sortedData.length}
          />
          <Table
            loading={set?.length == 0}
            data={sortedData}
            height={window.innerHeight - 100}
            onRowClick={handleClick}
            virtualized
            sortColumn={sortColumn}
            sortType={sortType}
            onSortColumn={handleSortColumn}
          >
            {columns.map(column => {
            const { key, label, ...rest } = column;
            return (
              <Column {...rest} key={key}>
                <HeaderCell>{label}</HeaderCell>
                <Cell dataKey={key} />
              </Column>
            );
          })}
          </Table>
        </Content>
      </Container>
    </CustomProvider>
  )
}

export default SetView;
