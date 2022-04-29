import React, { useState } from 'react';
import { CustomProvider } from 'rsuite';

import NavigationBar from './NavigationBar';

/**
 * Renders the home page of the website
 * @returns React Component
 */
const Home = () => {
  const [active, setActive] = useState('home');

  return (
    <CustomProvider theme="dark">
      <NavigationBar active={active} setActive={setActive} />
      <div>Welcome to MTG Card Loader</div>
    </CustomProvider>
  );
};

export default Home;