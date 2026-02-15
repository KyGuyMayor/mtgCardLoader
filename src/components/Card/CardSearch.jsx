import React, { useState } from 'react';
import { Container, Content, CustomProvider, Heading } from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';
import SearchBar from '../Shared/SearchBar';

/**
 * Renders the card search select box.
 * @returns React Component
 */
const CardSearch = () => {
  const [term, setTerm] = useState('');
  const search = async (searchTerm) => {
    const results =  await fetch(`/cards/search/${searchTerm}`);
    const data = await results.text();
    return data;
  };

  const goToCard = (card) => {
    if (card && card.id) {
      window.location.assign(`/cardsearch/${card.id}`);
    }
  };

  const wrapperStyles = {
    width: '95%',
    marginLeft: 'auto',
    marginRight: 'auto'
  }

  return (
    <CustomProvider theme="dark">
      <NavigationBar />
      <Container>
        <Heading align="center" level={3}>Card Search</Heading>
        <Content style={{ marginTop: "15px" }}>
          <div style={wrapperStyles}>
            <SearchBar term={term} retrieve={search} setTerm={setTerm} onSelect={goToCard} placeholder={'Enter a Card Name. Minimum 3 characters to search'} />
          </div>
        </Content>
      </Container>
    </CustomProvider>
  )
}

export default CardSearch;
