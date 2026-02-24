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
import { CONDITION_OPTIONS, FINISH_OPTIONS } from './CardEntryFormOptions';

const CONSTRUCTED_DECK_TYPES = [
   'COMMANDER', 'STANDARD', 'MODERN', 'LEGACY', 'VINTAGE', 'PIONEER', 'PAUPER', 'PLANAR_STANDARD', 'OATHBREAKER',
 ];

 const PRINTING_PREVIEW_HEIGHT = 70;
 const PRINTING_PREVIEW_BORDER_RADIUS = 4;
 const PRINTING_PREVIEW_MARGIN_TOP = 8;

 const INITIAL_FORM = {
     collection_id: null,
     scryfall_id: null,
     quantity: 1,
     condition: 'NM',
     finish: 'nonfoil',
     purchase_price: '',
     notes: '',
     is_commander: false,
     is_sideboard: false,
     is_signature_spell: false,
   };

 const AddToCollectionModal = ({ open, onClose, onSuccess, scryfallId, cardName, card, preSelectedCollectionId }) => {
   const [formData, setFormData] = useState({ ...INITIAL_FORM });
   const [collections, setCollections] = useState([]);
   const [loadingCollections, setLoadingCollections] = useState(false);
   const [error, setError] = useState('');
   const [submitting, setSubmitting] = useState(false);
   const [warnings, setWarnings] = useState([]);
   const [printings, setPrintings] = useState([]);
   const [loadingPrintings, setLoadingPrintings] = useState(false);
   const toaster = useToaster();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // Initialize form with current scryfallId
    if (scryfallId && !formData.scryfall_id) {
      setFormData(prev => ({ ...prev, scryfall_id: scryfallId }));
    }

    const fetchCollections = async () => {
      setLoadingCollections(true);
      try {
        const response = await authFetch('/collections');
        if (response.ok && !cancelled) {
          const data = await response.json();
          setCollections(data);
          if (preSelectedCollectionId) {
            setField('collection_id', preSelectedCollectionId);
          }
        }
      } catch (err) {
        // silent fail, user will see empty dropdown
      } finally {
        if (!cancelled) setLoadingCollections(false);
      }
    };

    const fetchPrintings = async () => {
      setLoadingPrintings(true);
      try {
        const response = await authFetch(`/cards/${scryfallId}/printings`);
        if (response.ok && !cancelled) {
          const data = await response.json();
          setPrintings(data);
        }
      } catch (err) {
        // silent fail - graceful degradation
      } finally {
        if (!cancelled) setLoadingPrintings(false);
      }
    };

    fetchCollections();
    if (scryfallId) {
      fetchPrintings();
    }
    return () => { cancelled = true; };
  }, [open, scryfallId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCollection = collections.find((c) => c.id === formData.collection_id);
  const isCommander = selectedCollection?.type === 'DECK' && selectedCollection?.deck_type === 'COMMANDER';
  const isOathbreaker = selectedCollection?.type === 'DECK' && selectedCollection?.deck_type === 'OATHBREAKER';
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
        scryfall_id: formData.scryfall_id || scryfallId,
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

      if (isOathbreaker) {
        body.is_commander = formData.is_commander;
        body.is_signature_spell = formData.is_signature_spell;
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

      setFormData({ ...INITIAL_FORM });
      setError('');
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
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
        next.is_signature_spell = false;
        // Fetch collection details and validate when collection changes
        if (value) {
          validateCollectionForDeck(value);
        } else {
          setWarnings([]);
        }
      }
      return next;
    });
  };

  const validateCollectionForDeck = async (collectionId) => {
    const col = collections.find((c) => c.id === collectionId);
    setWarnings([]);

    // Only validate for DECK type collections
    if (!col || col.type !== 'DECK') {
      return;
    }

    // Get format rules
    const formatRules = DECK_FORMAT_RULES[col.deck_type];
    if (!formatRules || col.deck_type === 'OTHER') {
      return;
    }

    try {
      // Fetch collection details with entries
      const response = await authFetch(`/collections/${collectionId}?limit=1000`);
      if (!response.ok) {
        return;
      }
      const details = await response.json();

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
      } else if (col.deck_type === 'PLANAR_STANDARD') {
        // Planar Standard: check set legality and banned list
        if (formatRules.bannedCards && formatRules.bannedCards.includes(card.name)) {
          validationWarnings.push(
            `This card is banned in Planar Standard`
          );
        }
        if (formatRules.legalSets && card.set && !formatRules.legalSets.includes(card.set)) {
          validationWarnings.push(
            `This card is not from a legal set in Planar Standard`
          );
        }
      } else if (col.deck_type === 'OATHBREAKER') {
        // Oathbreaker: check Scryfall oathbreaker legality
        const legality = card.legalities?.oathbreaker;
        if (legality !== 'legal' && legality !== 'restricted' && !isBasicLand(card.name)) {
          validationWarnings.push(
            `This card is not legal in Oathbreaker`
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
                disabled={!!preSelectedCollectionId}
              />
            </Form.Group>

            {!loadingPrintings && printings.length > 0 && (
              <Form.Group>
                <Form.ControlLabel>Printing</Form.ControlLabel>
                {loadingPrintings ? (
                  <Loader content="Loading printings..." />
                ) : (
                  <>
                    <SelectPicker
                      data={printings.map((p) => ({
                        label: `${p.set_name} (${p.collector_number})`,
                        value: p.id,
                      }))}
                      value={formData.scryfall_id}
                      onChange={(value) => setField('scryfall_id', value)}
                      searchable={false}
                      block
                      placeholder="Select printing"
                    />
                    {formData.scryfall_id && (
                      <div style={{ marginTop: PRINTING_PREVIEW_MARGIN_TOP }}>
                        {(() => {
                          const selected = printings.find((p) => p.id === formData.scryfall_id);
                          if (selected && selected.image_uris) {
                            return (
                              <img
                                src={selected.image_uris.normal}
                                alt={selected.name}
                                style={{ height: PRINTING_PREVIEW_HEIGHT, borderRadius: PRINTING_PREVIEW_BORDER_RADIUS }}
                              />
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </>
                )}
              </Form.Group>
            )}

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

            {(isCommander || isOathbreaker) && (
              <Form.Group>
                <Checkbox
                  checked={formData.is_commander}
                  onChange={(_, checked) => {
                    setField('is_commander', checked);
                    if (checked && isOathbreaker) setField('is_signature_spell', false);
                  }}
                >
                  {isOathbreaker ? 'Oathbreaker' : 'Commander'}
                </Checkbox>
              </Form.Group>
            )}

            {isOathbreaker && (
              <Form.Group>
                <Checkbox
                  checked={formData.is_signature_spell}
                  onChange={(_, checked) => {
                    setField('is_signature_spell', checked);
                    if (checked) setField('is_commander', false);
                  }}
                >
                  Signature Spell
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
