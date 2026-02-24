import React, { useState, useMemo } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  Message,
} from 'rsuite';
import authFetch from '../../helpers/authFetch';
import { DECK_FORMAT_RULES } from '../../helpers/deckRules';
import { CollectionTypeSelector, DeckTypeSelector } from './CollectionTypeSelectors';

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

  // Generate deck format hints based on selected deck_type
  const deckHints = useMemo(() => {
    if (!formData.deck_type || formData.deck_type === 'OTHER') {
      return null;
    }

    const rules = DECK_FORMAT_RULES[formData.deck_type];
    if (!rules) {
      return null;
    }

    const hints = [];

    // Deck size hint
    if (rules.minDeckSize !== null && rules.maxDeckSize !== null) {
      hints.push(`Exactly ${rules.minDeckSize} cards`);
    } else if (rules.minDeckSize !== null) {
      hints.push(`Minimum ${rules.minDeckSize} cards`);
    }

    // Copy limit hint
    if (rules.singleton) {
      hints.push('Singleton: 1 copy per card');
    } else if (rules.maxCopies !== null) {
      hints.push(`Max ${rules.maxCopies} copies per card`);
    }

    // Sideboard hint
    if (rules.sideboardSize === 0) {
      hints.push('No sideboard');
    } else if (rules.sideboardSize !== null) {
      hints.push(`Up to ${rules.sideboardSize} card sideboard`);
    }

    // Basic land exemption
    if (rules.basicLandExempt && !rules.singleton) {
      hints.push('Basic lands exempt from copy limit');
    }

    // Commander-specific and Oathbreaker hints
    if (rules.requiresCommander) {
      if (formData.deck_type === 'OATHBREAKER') {
        hints.push(`Requires a ${rules.commanderLabel} (Planeswalker)`);
        hints.push('Requires a Signature Spell (Instant or Sorcery)');
        hints.push(`Cards must match ${rules.commanderLabel.toLowerCase()} color identity`);
      } else {
        hints.push('Requires a Legendary Creature as commander');
        hints.push('Cards must match commander color identity');
      }
    }

    // Planar Standard-specific hints
    if (formData.deck_type === 'PLANAR_STANDARD') {
      hints.push('Universe Within cards only');
      if (rules.legalSetNames) {
        const setNames = Object.values(rules.legalSetNames).join(', ');
        hints.push(`Legal sets: ${setNames}`);
      } else if (rules.legalSets && rules.legalSets.length > 0) {
        hints.push(`Legal sets: ${rules.legalSets.join(', ').toUpperCase()}`);
      }
    }

    return hints.length > 0 ? hints : null;
  }, [formData.deck_type]);

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
            <CollectionTypeSelector
              value={formData.type}
              onChange={(value) => setField('type', value)}
            />
          </Form.Group>

          {formData.type === 'DECK' && (
            <>
              <Form.Group>
                <Form.ControlLabel>Deck Type</Form.ControlLabel>
                <DeckTypeSelector
                  value={formData.deck_type}
                  onChange={(value) => setField('deck_type', value)}
                />
              </Form.Group>

              {deckHints && (
                <Message type="info" showIcon style={{ marginBottom: 16 }}>
                  <div>
                    {deckHints.map((hint, idx) => (
                      <div key={idx} style={{ marginBottom: idx < deckHints.length - 1 ? 6 : 0 }}>
                        • {hint}
                      </div>
                    ))}
                  </div>
                </Message>
              )}
            </>
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
