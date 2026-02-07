import React, { useState } from 'react';
import {
  Modal,
  Button,
  Form,
  SelectPicker,
  Input,
  Message,
} from 'rsuite';
import authFetch from '../../helpers/authFetch';

const TYPE_OPTIONS = [
  { label: 'Trade Binder', value: 'TRADE_BINDER' },
  { label: 'Deck', value: 'DECK' },
];

const DECK_TYPE_OPTIONS = [
  { label: 'Commander', value: 'COMMANDER' },
  { label: 'Standard', value: 'STANDARD' },
  { label: 'Modern', value: 'MODERN' },
  { label: 'Legacy', value: 'LEGACY' },
  { label: 'Vintage', value: 'VINTAGE' },
  { label: 'Pioneer', value: 'PIONEER' },
  { label: 'Pauper', value: 'PAUPER' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Other', value: 'OTHER' },
];

const INITIAL_FORM = {
  name: '',
  type: null,
  deck_type: null,
  description: '',
};

const CreateCollectionModal = ({ open, onClose, onCreated }) => {
  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setFormData({ ...INITIAL_FORM });
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    setError('');

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!formData.type) {
      setError('Type is required');
      return;
    }

    if (formData.type === 'DECK' && !formData.deck_type) {
      setError('Deck type is required for Deck collections');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name: formData.name.trim(),
        type: formData.type,
        description: formData.description.trim() || undefined,
      };

      if (formData.type === 'DECK') {
        body.deck_type = formData.deck_type;
      }

      const response = await authFetch('/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to create collection');
        return;
      }

      handleClose();
      if (onCreated) onCreated();
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'type' && value !== 'DECK') {
        next.deck_type = null;
      }
      return next;
    });
  };

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <Modal.Header>
        <Modal.Title>Create New Collection</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Message type="error" showIcon style={{ marginBottom: 16 }}>
            {error}
          </Message>
        )}
        <Form fluid>
          <Form.Group>
            <Form.ControlLabel>Name</Form.ControlLabel>
            <Input
              value={formData.name}
              onChange={(value) => setField('name', value)}
              placeholder="Collection name"
            />
          </Form.Group>

          <Form.Group>
            <Form.ControlLabel>Type</Form.ControlLabel>
            <SelectPicker
              data={TYPE_OPTIONS}
              value={formData.type}
              onChange={(value) => setField('type', value)}
              searchable={false}
              block
              placeholder="Select type"
            />
          </Form.Group>

          {formData.type === 'DECK' && (
            <Form.Group>
              <Form.ControlLabel>Deck Type</Form.ControlLabel>
              <SelectPicker
                data={DECK_TYPE_OPTIONS}
                value={formData.deck_type}
                onChange={(value) => setField('deck_type', value)}
                searchable={false}
                block
                placeholder="Select deck type"
              />
            </Form.Group>
          )}

          <Form.Group>
            <Form.ControlLabel>Description</Form.ControlLabel>
            <Input
              as="textarea"
              rows={3}
              value={formData.description}
              onChange={(value) => setField('description', value)}
              placeholder="Optional description"
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleClose} appearance="subtle">
          Cancel
        </Button>
        <Button onClick={handleSubmit} appearance="primary" loading={submitting}>
          Create
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateCollectionModal;
