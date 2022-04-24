import React, { useState } from 'react';

import NavigationBar from './NavigationBar';

/**
 * Renders the home page of the website
 * @returns React Component
 */
const Home = () => {
  const [active, setActive] = useState('home');

  return (
    <div>
      <NavigationBar active={active} setActive={setActive} />
      <div>Welcome to MTG Card Loader</div>
    </div>
  );
};

export default Home;