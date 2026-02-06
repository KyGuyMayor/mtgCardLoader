import React, { useState } from 'react';
import { Container, Content, CustomProvider, Form, Button, Panel, Message } from 'rsuite';
import { useNavigate } from 'react-router-dom';

import NavigationBar from '../Shared/NavigationBar';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
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
          <Panel header="Register" bordered style={styles.panel}>
            {error && (
              <Message type="error" showIcon style={{ marginBottom: 16 }}>
                {error}
              </Message>
            )}
            {success && (
              <Message type="success" showIcon style={{ marginBottom: 16 }}>
                {success}
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
                  placeholder="Enter a password"
                />
              </Form.Group>
              <Form.Group>
                <Form.ControlLabel>Confirm Password</Form.ControlLabel>
                <Form.Control
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm your password"
                />
              </Form.Group>
              <Form.Group>
                <Button
                  appearance="primary"
                  block
                  loading={loading}
                  onClick={handleSubmit}
                >
                  Register
                </Button>
              </Form.Group>
            </Form>
            <p style={{ marginTop: 16, textAlign: 'center' }}>
              Already have an account? <a href="/login">Login here</a>
            </p>
          </Panel>
        </Content>
      </Container>
    </CustomProvider>
  );
};

export default Register;
