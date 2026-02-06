import React from 'react';
import { Header, Navbar, Nav } from 'rsuite';
import { isMobile } from 'react-device-detect';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Auth/AuthContext';

const PATH_TO_KEY = {
  '/': 'home',
  '/cardsearch': 'cardSearch',
  '/setsearch': 'setSearch',
  '/collections': 'myCollection',
  '/login': 'login',
  '/register': 'register',
};

const getActiveKey = (pathname) => {
  if (PATH_TO_KEY[pathname]) return PATH_TO_KEY[pathname];
  if (pathname.startsWith('/cardsearch/')) return 'cardSearch';
  if (pathname.startsWith('/set/')) return 'setSearch';
  if (pathname.startsWith('/collections/')) return 'myCollection';
  return 'home';
};

const NavigationBar = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = getActiveKey(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Header>
      <Navbar appearance="inverse">
        <Navbar.Brand href="/">MTG Card Loader</Navbar.Brand>
        <Nav activeKey={active}>
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
