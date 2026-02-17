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
import { DECK_FORMAT_RULES, isBasicLand } from '../../helpers/deckRules';

const CONDITION_OPTIONS = [
  { label: 'Mint', value: 'MINT' },
  { label: 'Near Mint', value: 'NM' },
  { label: 'Lightly Played', value: 'LP' },
  { label: 'Moderately Played', value: 'MP' },
  { label: 'Heavily Played', value: 'HP' },
  { label: 'Damaged', value: 'DAMAGED' },
];

const FINISH_OPTIONS = [
  { label: 'Non-Foil', value: 'nonfoil' },
  { label: 'Foil', value: 'foil' },
  { label: 'Etched', value: 'etched' },
];

const CONSTRUCTED_DECK_TYPES = [
  'COMMANDER', 'STANDARD', 'MODERN', 'LEGACY', 'VINTAGE', 'PIONEER', 'PAUPER',
];

const INITIAL_FORM = {
  collection_id: null,
  quantity: 1,
  condition: 'NM',
  finish: 'nonfoil',
  purchase_price: '',
  notes: '',
  is_commander: false,
  is_sideboard: false,
};

const AddToCollectionModal = ({ open, onClose, scryfallId, cardName, card }) => {
  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [loadingCollectionDetails, setLoadingCollectionDetails] = useState(false);
  const [collectionDetails, setCollectionDetails] = useState(null);
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
        finish: formData.finish,
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
        // Fetch collection details and validate when collection changes
        if (value) {
          validateCollectionForDeck(value);
        } else {
          setWarnings([]);
          setCollectionDetails(null);
        }
      }
      return next;
    });
  };

  const validateCollectionForDeck = async (collectionId) => {
    const col = collections.find((c) => c.id === collectionId);
    setWarnings([]);
    setCollectionDetails(null);

    // Only validate for DECK type collections
    if (!col || col.type !== 'DECK') {
      return;
    }

    // Get format rules
    const formatRules = DECK_FORMAT_RULES[col.deck_type];
    if (!formatRules || col.deck_type === 'OTHER') {
      return;
    }

    setLoadingCollectionDetails(true);
    try {
      // Fetch collection details with entries
      const response = await authFetch(`/collections/${collectionId}?limit=1000`);
      if (!response.ok) {
        return;
      }
      const details = await response.json();
      setCollectionDetails(details);

      // Only validate if we have a card object with necessary data
      if (!card) {
        return;
      }

      const validationWarnings = [];

      // 1. Check format legality
      if (formatRules.scryfallLegalityKey) {
        const legality = card.legalities?.[formatRules.scryfallLegalityKey];
        if (legality !== 'legal' && legality !== 'restricted' && !isBasicLand(card.name)) {
          validationWarnings.push(
            `This card is not legal in ${formatRules.name}`
          );
        }
      }

      // 2. Check copy limit (by card name, not scryfall_id, to catch different printings)
      const existingEntries = details.entries || [];
      
      // Fetch card data for all entries to match by card name (not scryfall_id)
      // This ensures that different printings of the same card count against the copy limit
      let entriesWithCardData = [];
      if (existingEntries.length > 0) {
        try {
          const cardBatch = await authFetch('/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identifiers: existingEntries.map(e => ({ id: e.scryfall_id })),
            }),
          });
          if (cardBatch.ok) {
            const { data: scCards } = await cardBatch.json();
            entriesWithCardData = existingEntries.map(e => ({
              ...e,
              cardName: scCards.find(c => c.id === e.scryfall_id)?.name || null,
            }));
          } else {
            entriesWithCardData = existingEntries;
          }
        } catch (err) {
          console.error('Failed to fetch card data for copy limit check:', err);
          entriesWithCardData = existingEntries;
        }
      }

      // Count copies of this card by name (all printings)
      const existingCopies = entriesWithCardData
        .filter((e) => e.cardName === card.name)
        .reduce((sum, e) => sum + (e.quantity || 1), 0);

      if (
        formatRules.maxCopies !== null &&
        !isBasicLand(card.name) &&
        existingCopies + 1 > formatRules.maxCopies
      ) {
        validationWarnings.push(
          `Adding this card would exceed the ${formatRules.maxCopies}-copy limit for ${formatRules.name}`
        );
      }

      // 3. Check color identity (Commander only)
      // Note: Full color identity validation requires fetching the commander card data
      // which would need an additional API call. This could be enhanced in future.
      if (col.deck_type === 'COMMANDER') {
        const commanderEntry = existingEntries.find((e) => e.is_commander);
        if (commanderEntry) {
          // Full validation would require fetching commander card data from Scryfall
          // and comparing card.color_identity against commander.color_identity
          // Skipped for now to avoid additional API call per card add
        }
      }

      setWarnings(validationWarnings);
    } catch (err) {
      console.error('Failed to validate collection:', err);
    } finally {
      setLoadingCollectionDetails(false);
    }
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

            {warnings.length > 0 && (
              <Message type="warning" showIcon style={{ marginBottom: 16 }}>
                <div>
                  {warnings.map((warning, idx) => (
                    <div key={idx}>{warning}</div>
                  ))}
                </div>
              </Message>
            )}

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
              <Form.ControlLabel>Finish</Form.ControlLabel>
              <SelectPicker
                data={FINISH_OPTIONS}
                value={formData.finish}
                onChange={(value) => setField('finish', value)}
                searchable={false}
                block
                placeholder="Select finish"
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
