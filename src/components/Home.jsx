import React, { useEffect, useState } from 'react';
import { CustomProvider } from 'rsuite';

import NavigationBar from './Shared/NavigationBar';
import ViewCard from './Shared/Card/ViewCard';

/**
 * Renders the home page of the website
 * @returns React Component
 */
const Home = () => {
  const [active, setActive] = useState('home');
  const [randomCard, setRandomCard] = useState(null);

  useEffect(() => {
    const fetchRandomCard = async () => {
      const results = await fetch('/cards/random');
      const data = await results.json();
      setRandomCard(data);
    };

    fetchRandomCard();
  }, []);

  return (
    <CustomProvider theme="dark">
      <NavigationBar active={active} setActive={setActive} />
      <div>Welcome to MTG Card Loader</div>
      {randomCard && <ViewCard card={randomCard} />}
    </CustomProvider>
  );
};

export default Home;