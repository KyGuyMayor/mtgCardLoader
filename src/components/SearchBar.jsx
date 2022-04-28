import React, { useEffect, useState } from 'react';
import { AutoComplete, InputGroup } from 'rsuite';

/**
 * Renders a react auto complete search bar.
 * @param {object} props Properties containing term, setTerm, and retrieve. Retrieve must be a promise
 * @returns React Component
 */
const SearchBar = (props) => {
  const [data, setData] = useState([]);
  const [selected, setSelected] = useState(false);

  const term = props.term;
  const setTerm = props.setTerm;
  const retrieve = props.retrieve;
  const onSelect = props.onSelect;

  useEffect(() => {
    /**
     * Retrieves cards matching the provided terms.
     */
    const fetchData = async () => {
      if (term && term.length >= 3) {
        try {
          const results = await retrieve(term);
          const formatedResults = JSON.parse(results);
          const cardNames = [];

          if (formatedResults.length === 1 && onSelect) {
            onSelect(formatedResults[0]);
          } else if (selected) {
            const selectedResult = formatedResults.find(card => card.name === term);

            onSelect(selectedResult);
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
      <AutoComplete
        placeholder='Enter a Card Name. Minimum 3 characters to search'
        data={data}
        onChange={setTerm}
        onSelect={setSelected}
      />
    </InputGroup>
  );
}

export default SearchBar;