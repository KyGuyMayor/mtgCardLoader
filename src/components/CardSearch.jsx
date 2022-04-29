import React, { useState } from 'react';
import { Button, Content, CustomProvider, InputGroup } from 'rsuite';

import NavigationBar from './NavigationBar';
import SearchBar from './SearchBar';

/**
 * Renders the card search select box.
 * @returns React Component
 */
const CardSearch = () => {
  const [active, setActive] = useState('cardSearch');
  const [term, setTerm] = useState('');
  const [card, setCard] = useState();
  const search = async (searchTerm) => {
    const results =  await fetch(`/cards/search/${searchTerm}`);
    const data = await results.text();
    return data;
  };

  const goToCard = () => {
    if (card && card.id) {
      window.location.assign(`/cardsearch/${card.id}`);
    }
  };

  const styles = {
    width: '95%',
    marginLeft: 'auto',
    marginRight: 'auto',
    border: 'none'
  }

  return (
    <CustomProvider theme="dark">
      <NavigationBar active={active} setActive={setActive} />
      <Content style={{ marginTop: "15px" }}>
        <InputGroup style={styles}>
          <SearchBar term={term} retrieve={search} setTerm={setTerm} onSelect={setCard} />
          <Button onClick={goToCard}>Select</Button>
        </InputGroup>
      </Content>
    </CustomProvider>
  )
}

export default CardSearch;