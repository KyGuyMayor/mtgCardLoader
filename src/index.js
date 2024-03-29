import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import 'rsuite/dist/rsuite.min.css';

import { Home, CardSearch, CardView, SetSearch, SetView } from './components';

ReactDOM.render(
  <Router>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/cardsearch" element={<CardSearch />} />
      <Route path="/cardsearch/:id" element={<CardView />} />
      <Route path="/setsearch" element={<SetSearch />} />
      <Route path="/set/:id" element={<SetView />} />
    </Routes>
  </Router>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
