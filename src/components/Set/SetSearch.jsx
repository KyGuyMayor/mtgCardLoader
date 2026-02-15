import React, { useState } from 'react';
import { Content, CustomProvider } from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';
import SearchBar from '../Shared/SearchBar';

/**
 * Renders the Set search select box
 * @returns React Component
 */
const SetSearch = () => {
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

  const wrapperStyles = {
    width: '95%',
    marginLeft: 'auto',
    marginRight: 'auto'
  }

   return (
    <CustomProvider theme="dark">
      <NavigationBar />
      <Content style={{ marginTop: "15px" }}>
        <div style={wrapperStyles}>
          <SearchBar term={term} retrieve={search} setTerm={setTerm} onSelect={goToSet} placeholder={'Enter a Set Name. Minimum 3 characters to search'} />
        </div>
      </Content>
    </CustomProvider>
  );
}

export default SetSearch;
