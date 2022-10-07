import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CustomProvider,
  Container,
  Content,
  Table
} from 'rsuite';

import Link from '../Shared/Link';
import NavigationBar from '../Shared/NavigationBar';

const { Column, HeaderCell, Cell } = Table;

const SetView = () => {
  const {id} = useParams();
  const { loading, setLoading } = useState(false);
  const [set, setSet] =  useState([]);
  const [active, setActive] = useState('setSearch');
  const defaultColumns = [
    {
      key: 'name',
      label: 'Name',
      fixed: true,
      flexGrow: 1,
      sortable: true
    },
    {
      key: 'set_name',
      label: 'Set',
      flexGrow: 1,
      sortable: true
    },
  
    {
      key: 'rarity',
      label: 'Rarity',
      flexGrow: 1,
      sortable: true
    },
    {
      key: 'type_line',
      label: 'Type',
      flexGrow: 1,
      sortable: true
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      const setData  = await fetch(`/sets/${id}`);
      const setJSON = await setData.json();
      const cards = setJSON.cards;
      setSet(cards);
    } 
       
    fetchData();
  }, [id]);

  const handleClick = (rowObject) => {
    console.log(rowObject);
    window.location.assign(`/cardsearch/${rowObject.id}`);
  }

  return (
    <CustomProvider theme="dark">
      <Container>
        <NavigationBar />
        <Content>
          {console.log(set)}
          <Table
            loading={loading}
            data={set}
            height={600}
            onRowClick={handleClick}
            virtualized
          >{defaultColumns.map(column => {
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