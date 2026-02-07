import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  SelectPicker,
  InputNumber,
  Input,
  Checkbox,
  Message,
  useToaster,
  Loader,
} from 'rsuite';
import authFetch from '../../helpers/authFetch';

const CONDITION_OPTIONS = [
  { label: 'Mint', value: 'MINT' },
  { label: 'Near Mint', value: 'NM' },
  { label: 'Lightly Played', value: 'LP' },
  { label: 'Moderately Played', value: 'MP' },
  { label: 'Heavily Played', value: 'HP' },
  { label: 'Damaged', value: 'DAMAGED' },
];

const CONSTRUCTED_DECK_TYPES = [
  'COMMANDER', 'STANDARD', 'MODERN', 'LEGACY', 'VINTAGE', 'PIONEER', 'PAUPER',
];

const INITIAL_FORM = {
  collection_id: null,
  quantity: 1,
  condition: 'NM',
  purchase_price: '',
  notes: '',
  is_commander: false,
  is_sideboard: false,
};

const AddToCollectionModal = ({ open, onClose, scryfallId, cardName }) => {
  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toaster = useToaster();

  useEffect(() => {
    if (open) {
      fetchCollections();
    }
  }, [open]);

  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      const response = await authFetch('/collections');
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (err) {
      // silent fail, user will see empty dropdown
    } finally {
      setLoadingCollections(false);
    }
  };

  const selectedCollection = collections.find((c) => c.id === formData.collection_id);
  const isCommander = selectedCollection?.type === 'DECK' && selectedCollection?.deck_type === 'COMMANDER';
  const isConstructed = selectedCollection?.type === 'DECK' && CONSTRUCTED_DECK_TYPES.includes(selectedCollection?.deck_type);

  const handleClose = () => {
    setFormData({ ...INITIAL_FORM });
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    setError('');

    if (!formData.collection_id) {
      setError('Please select a collection');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        scryfall_id: scryfallId,
        quantity: formData.quantity,
        condition: formData.condition,
      };

      if (formData.purchase_price !== '') {
        body.purchase_price = parseFloat(formData.purchase_price);
      }

      if (formData.notes.trim()) {
        body.notes = formData.notes.trim();
      }

      if (isCommander) {
        body.is_commander = formData.is_commander;
      }

      if (isConstructed) {
        body.is_sideboard = formData.is_sideboard;
      }

      const response = await authFetch(`/collections/${formData.collection_id}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to add card');
        return;
      }

      toaster.push(
        <Message type="success" showIcon closable>
          <strong>{cardName}</strong> added to <strong>{selectedCollection?.name}</strong>
        </Message>,
        { placement: 'topCenter', duration: 3000 }
      );

      handleClose();
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'collection_id') {
        next.is_commander = false;
        next.is_sideboard = false;
      }
      return next;
    });
  };

  const collectionOptions = collections.map((c) => ({
    label: `${c.name} (${c.type === 'DECK' ? 'Deck' : 'Trade Binder'})`,
    value: c.id,
  }));

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <Modal.Header>
        <Modal.Title>Add to Collection</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p style={{ marginBottom: 16 }}>
          Adding <strong>{cardName}</strong>
        </p>

        {error && (
          <Message type="error" showIcon style={{ marginBottom: 16 }}>
            {error}
          </Message>
        )}

        {loadingCollections ? (
          <Loader content="Loading collections..." />
        ) : (
          <Form fluid>
            <Form.Group>
              <Form.ControlLabel>Collection</Form.ControlLabel>
              <SelectPicker
                data={collectionOptions}
                value={formData.collection_id}
                onChange={(value) => setField('collection_id', value)}
                searchable={false}
                block
                placeholder="Select a collection"
              />
            </Form.Group>

            <Form.Group>
              <Form.ControlLabel>Quantity</Form.ControlLabel>
              <InputNumber
                value={formData.quantity}
                onChange={(value) => setField('quantity', parseInt(value, 10) || 1)}
                min={1}
                max={999}
                style={{ width: '100%' }}
              />
            </Form.Group>

            <Form.Group>
              <Form.ControlLabel>Condition</Form.ControlLabel>
              <SelectPicker
                data={CONDITION_OPTIONS}
                value={formData.condition}
                onChange={(value) => setField('condition', value)}
                searchable={false}
                block
                placeholder="Select condition"
              />
            </Form.Group>

            <Form.Group>
              <Form.ControlLabel>Purchase Price (optional)</Form.ControlLabel>
              <InputNumber
                value={formData.purchase_price}
                onChange={(value) => setField('purchase_price', value)}
                min={0}
                step={0.01}
                prefix="$"
                style={{ width: '100%' }}
              />
            </Form.Group>

            <Form.Group>
              <Form.ControlLabel>Notes (optional)</Form.ControlLabel>
              <Input
                as="textarea"
                rows={2}
                value={formData.notes}
                onChange={(value) => setField('notes', value)}
                placeholder="Optional notes"
              />
            </Form.Group>

            {isCommander && (
              <Form.Group>
                <Checkbox
                  checked={formData.is_commander}
                  onChange={(_, checked) => setField('is_commander', checked)}
                >
                  Commander
                </Checkbox>
              </Form.Group>
            )}

            {isConstructed && (
              <Form.Group>
                <Checkbox
                  checked={formData.is_sideboard}
                  onChange={(_, checked) => setField('is_sideboard', checked)}
                >
                  Sideboard
                </Checkbox>
              </Form.Group>
            )}
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleClose} appearance="subtle">
          Cancel
        </Button>
        <Button onClick={handleSubmit} appearance="primary" loading={submitting}>
          Add
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddToCollectionModal;
