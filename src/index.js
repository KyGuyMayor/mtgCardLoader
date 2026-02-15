import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import 'rsuite/dist/rsuite.min.css';

import { Home, CardSearch, CardView, SetSearch, SetView, Login, Register, ForgotPassword, ResetPassword, CollectionsDashboard, CollectionDetail, ProtectedRoute } from './components';
import { AuthProvider } from './components/Auth/AuthContext';

ReactDOM.render(
  <Router>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cardsearch" element={<CardSearch />} />
        <Route path="/cardsearch/:id" element={<CardView />} />
        <Route path="/setsearch" element={<SetSearch />} />
        <Route path="/set/:id" element={<SetView />} />
        <Route path="/collections" element={<ProtectedRoute><CollectionsDashboard /></ProtectedRoute>} />
        <Route path="/collections/:id" element={<ProtectedRoute><CollectionDetail /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </AuthProvider>
  </Router>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
