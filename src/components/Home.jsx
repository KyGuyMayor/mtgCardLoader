import React, { useState } from 'react';

import NavigationBar from './NavigationBar';

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