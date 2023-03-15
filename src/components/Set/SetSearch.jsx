import React, { useState } from 'react';
import { Content, CustomProvider, InputGroup } from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';
import SearchBar from '../Shared/SearchBar';

/**
 * Renders the Set search select box
 * @returns React Component
 */
const SetSearch = () => {
  const [active, setActive] = useState('setSearch');
  const [term, setTerm] = useState('');
  const search = async (searchTerm) => {
    const results =  await fetch(`/sets/search/${searchTerm}`);
    const data = await results.text();
    return data;
  };

   const goToSet = (set) => {
    if (set && set.id) {
      window.location.assign(`/set/${set.id}`);
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
        <InputGroup styles={styles}>
          <SearchBar term={term} retrieve={search} setTerm={setTerm} onSelect={goToSet} placeholder={'Enter a Set Name. Minimum 3 characters to search'} />
        </InputGroup>
      </Content>
    </CustomProvider>
  );
}

export default SetSearch;
