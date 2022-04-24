import React from 'react';
import { Navbar, Nav } from 'rsuite';

const NavigationBar = (props) => {
  return (
    <Navbar appearance="inverse">
      <Navbar.Brand href="/">MTG Card Loader</Navbar.Brand>
      <Nav activeKey={props.active} onSelect={props.setActive}>
        <Nav.Item href="/" eventKey="home">Home</Nav.Item>
        <Nav.Item href="/cardsearch" eventKey="cardSearch">Card Search</Nav.Item>
        <Nav.Item href="/setsearch" eventKey="setSearch">Set Search</Nav.Item>
        <Nav.Item href="/myCollection" eventKey="myCollection">My Collection</Nav.Item>
      </Nav>
      <Nav pullRight>
        <Nav.Item href="/settings" eventKey="settings">Settings</Nav.Item>
      </Nav>
    </Navbar>
  );
};

export default NavigationBar;
