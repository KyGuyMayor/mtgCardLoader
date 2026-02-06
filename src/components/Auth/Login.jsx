import React, { useState } from 'react';
import { Container, Content, CustomProvider, Form, Button, Panel, Message } from 'rsuite';
import { useNavigate } from 'react-router-dom';

import NavigationBar from '../Shared/NavigationBar';
import { useAuth } from './AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async () => {
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid credentials');
        return;
      }

      login(data.token);
      navigate('/collections');
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    panel: {
      maxWidth: 400,
      margin: '60px auto',
    },
  };

  return (
    <CustomProvider theme="dark">
      <NavigationBar />
      <Container>
        <Content>
          <Panel header="Login" bordered style={styles.panel}>
            {error && (
              <Message type="error" showIcon style={{ marginBottom: 16 }}>
                {error}
              </Message>
            )}
            <Form fluid>
              <Form.Group>
                <Form.ControlLabel>Email</Form.ControlLabel>
                <Form.Control
                  name="email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Enter your email"
                />
              </Form.Group>
              <Form.Group>
                <Form.ControlLabel>Password</Form.ControlLabel>
                <Form.Control
                  name="password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                />
              </Form.Group>
              <Form.Group>
                <Button
                  appearance="primary"
                  block
                  loading={loading}
                  onClick={handleSubmit}
                >
                  Login
                </Button>
              </Form.Group>
            </Form>
            <p style={{ marginTop: 16, textAlign: 'center' }}>
              Don't have an account? <a href="/register">Register here</a>
            </p>
          </Panel>
        </Content>
      </Container>
    </CustomProvider>
  );
};

export default Login;
