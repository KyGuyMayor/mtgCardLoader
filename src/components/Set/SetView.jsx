import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import {
  CustomProvider,
  Container,
  Content,
  Table
} from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';

const { Column, HeaderCell, Cell } = Table;

const SetView = () => {
  const {id} = useParams();
  const [set, setSet] =  useState([]);
  const [active, setActive] = useState('setSearch');
  /**
   * TODO: Add sort and enable sort for name, type, rarity, and color
   */
  const defaultColumns = [
    {
      key: 'name',
      label: 'Name',
      fixed: true,
      flexGrow: 1,
      sortable: false
    },
    {
      key: 'type_line',
      label: 'Type',
      flexGrow: 1,
      sortable: false
    },
  ];
  
  const desktopColumns = [
    {
      key: 'rarity',
      label: 'Rarity',
      flexGrow: 1,
      sortable: false
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
  }, []);

  const handleClick = (rowObject) => {
    window.location.assign(`/cardsearch/${rowObject.id}`);
  }

  const columns = isMobile ? defaultColumns : defaultColumns.concat(desktopColumns);

  return (
    <CustomProvider theme="dark">
      <Container>
        <NavigationBar active={active} setActive={setActive} />
        <Content>
          <Table
            loading={set?.length == 0}
            data={set}
            height={window.innerHeight - 100}
            onRowClick={handleClick}
            virtualized
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
