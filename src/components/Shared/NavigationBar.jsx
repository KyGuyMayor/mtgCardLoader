import React from 'react';
import { Header, Navbar, Nav } from 'rsuite';
import { isMobile } from 'react-device-detect';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Auth/AuthContext';

const NavigationBar = (props) => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Header>
      <Navbar appearance="inverse">
        <Navbar.Brand href="/">MTG Card Loader</Navbar.Brand>
        <Nav activeKey={props.active} onSelect={props.setActive}>
          <Nav.Item href="/" eventKey="home">Home</Nav.Item>
          <Nav.Item href="/cardsearch" eventKey="cardSearch">Card Search</Nav.Item>
          <Nav.Item href="/setsearch" eventKey="setSearch">Set Search</Nav.Item>
          {isAuthenticated && (
            <Nav.Item href="/collections" eventKey="myCollection">My Collection</Nav.Item>
          )}
        </Nav>
        {!isMobile && <Nav pullRight>
          {isAuthenticated ? (
            <Nav.Item eventKey="logout" onSelect={handleLogout}>Logout</Nav.Item>
          ) : (
            <>
              <Nav.Item href="/login" eventKey="login">Login</Nav.Item>
              <Nav.Item href="/register" eventKey="register">Register</Nav.Item>
            </>
          )}
        </Nav>}
      </Navbar>
    </Header>
  );
};

export default NavigationBar;
