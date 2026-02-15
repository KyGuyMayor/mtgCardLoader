import React, { useEffect, useState } from 'react';
import { AutoComplete, Badge } from 'rsuite';

/**
 * Check if a card is double-faced (transform, modal DFC, etc.)
 */
const isDoubleFaced = (card) => card?.card_faces && !card?.image_uris;

/**
 * Renders a react auto complete search bar.
 * @param {object} props Properties containing term, setTerm, and retrieve. Retrieve must be a promise
 * @returns React Component
 */
const SearchBar = (props) => {
  const [data, setData] = useState([]);
  const [cards, setCards] = useState([]);

  const term = props.term;
  const setTerm = props.setTerm;
  const retrieve = props.retrieve;
  const onSelect = props.onSelect;
  const placeholder = props.placeholder;

  useEffect(() => {
    /**
     * Retrieves cards matching the provided terms.
     */
    const fetchData = async () => {
      // Only fetch if term doesn't contain // (double-faced card names break the URL)
      // and term is at least 3 characters
      if (term && term.length >= 3 && !term.includes('//')) {
        try {
          const results = await retrieve(term);
          const formatedResults = JSON.parse(results);
          const cardNames = [];

          formatedResults.forEach((result) => {
            cardNames.push(result.name);
          });

          setData(cardNames);
          setCards(formatedResults);
        } catch(e) {
          console.error(e);
        }
      } else if (!term || term.length < 3) {
        setData([]);
        setCards([]);
      }
      // If term contains //, keep the existing cards data (don't clear or refetch)
    }

    fetchData();
  }, [term, retrieve]);

  const handleSelect = (value) => {
    // Find the card by name and call onSelect directly with the card object
    const selectedCard = cards.find(card => card.name === value);
    if (selectedCard) {
      onSelect(selectedCard);
    }
  };

  const renderMenuItem = (label, item) => {
    const card = cards.find(c => c.name === label);
    const isDFC = card && isDoubleFaced(card);
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {isDFC && (
          <Badge 
            content="DFC" 
            style={{ 
              marginLeft: '8px',
              backgroundColor: '#6c757d',
              fontSize: '10px'
            }} 
          />
        )}
      </div>
    );
  };

  return (
    <AutoComplete
      placeholder={placeholder}
      data={data}
      onChange={setTerm}
      onSelect={handleSelect}
      renderMenuItem={renderMenuItem}
    />
  );
}

export default SearchBar;