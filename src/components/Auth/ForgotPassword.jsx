import React, { useState } from 'react';
import { Container, Content, CustomProvider, Form, Button, Panel, Message } from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!email) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Something went wrong');
        return;
      }

      setSuccess('If an account with that email exists, a reset link has been sent.');
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
          <Panel header="Forgot Password" bordered style={styles.panel}>
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
                <Button
                  appearance="primary"
                  block
                  loading={loading}
                  onClick={handleSubmit}
                >
                  Send Reset Link
                </Button>
              </Form.Group>
            </Form>
            <p style={{ marginTop: 16, textAlign: 'center' }}>
              Remember your password? <a href="/login">Login here</a>
            </p>
          </Panel>
        </Content>
      </Container>
    </CustomProvider>
  );
};

export default ForgotPassword;
