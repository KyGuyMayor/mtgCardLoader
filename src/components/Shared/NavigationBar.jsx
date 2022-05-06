import React from 'react';
import { Header, Navbar, Nav } from 'rsuite';

/**
 * Renders an rsuite navbar with links to navigate the website.
 * @param {*} props
 * @returns a React Component 
 */
const NavigationBar = (props) => (
  <Header>
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
  </Header>
);

export default NavigationBar;
