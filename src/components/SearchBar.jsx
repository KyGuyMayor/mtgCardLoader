import React, { useEffect, useState } from 'react';
import { AutoComplete, InputGroup } from 'rsuite';

/**
 * Renders a react auto complete search bar.
 * @param {object} props Properties containing term, setTerm, and retrieve. Retrieve must be a promise
 * @returns 
 */
const SearchBar = (props) => {
  const [data, setData] = useState([]);
  const term = props.term;
  const setTerm = props.setTerm;
  const retrieve = props.retrieve;
  const onSelect = props.onSelect;
  useEffect(() => {
    const fetchData = async () => {
      if (term && term.length >= 3) {
        try {
          const results = await retrieve(term);
          const formatedResults = JSON.parse(results);
          const cardNames = [];

          if (formatedResults.length === 1 && onSelect) {
            onSelect(formatedResults[0]);
          }

          formatedResults.forEach((result) => {
            cardNames.push(result.name);
          });

          setData(cardNames);
        } catch(e) {
          console.error(e);
        }
      } else {
        setData([]);
      }
    }

    fetchData();
  }, [term]);

  return (
    <InputGroup>
      <AutoComplete placeholder='Enter Card Name' data={data} onChange={setTerm} onSelect={(e) => {
        console.log(e);
      }} />
    </InputGroup>
  );
}

export default SearchBar;