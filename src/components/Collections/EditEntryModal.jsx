import React, { useState, useEffect } from 'react';
import {
   Modal,
   Button,
   Form,
   SelectPicker,
   InputNumber,
   Input,
   Message,
   useToaster,
   ButtonGroup,
   Loader,
 } from 'rsuite';
 import authFetch from '../../helpers/authFetch';
 import { CONDITION_OPTIONS, FINISH_OPTIONS } from './CardEntryFormOptions';

 const PRINTING_PREVIEW_HEIGHT = 70;
 const PRINTING_PREVIEW_BORDER_RADIUS = 4;
 const PRINTING_PREVIEW_MARGIN_TOP = 8;

 const EditEntryModal = ({ open, onClose, entry, collectionId, onUpdated }) => {
   const [formData, setFormData] = useState({
     scryfall_id: null,
     quantity: 1,
     condition: 'NM',
     finish: 'nonfoil',
     purchase_price: '',
     notes: '',
   });
   const [error, setError] = useState('');
   const [submitting, setSubmitting] = useState(false);
   const [printings, setPrintings] = useState([]);
   const [loadingPrintings, setLoadingPrintings] = useState(false);
   const [originalScryfallId, setOriginalScryfallId] = useState(null);
   const toaster = useToaster();

  useEffect(() => {
    if (open && entry) {
      const finish = entry.finish || 'nonfoil';
      setFormData({
        scryfall_id: entry.scryfall_id,
        quantity: entry.quantity || 1,
        condition: entry.condition || 'NM',
        finish: finish,
        purchase_price: entry.purchase_price != null ? entry.purchase_price : '',
        notes: entry.notes || '',
      });
      setOriginalScryfallId(entry.scryfall_id);
      setError('');

      // Fetch printings for this card
      const fetchPrintings = async () => {
        setLoadingPrintings(true);
        try {
          const response = await authFetch(`/cards/${entry.scryfall_id}/printings`);
          if (response.ok) {
            const data = await response.json();
            setPrintings(data);
          }
        } catch (err) {
          // silent fail - graceful degradation
        } finally {
          setLoadingPrintings(false);
        }
      };

      if (entry.scryfall_id) {
        fetchPrintings();
      }
    }
  }, [open, entry]);

  const handleClose = () => {
    setError('');
    onClose();
  };

  const setField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const adjustQuantity = (delta) => {
    setFormData((prev) => ({
      ...prev,
      quantity: Math.max(1, (prev.quantity || 1) + delta),
    }));
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const body = {
        quantity: formData.quantity,
        condition: formData.condition,
        finish: formData.finish,
      };

      // Only send scryfall_id if it changed
      if (formData.scryfall_id !== originalScryfallId) {
        body.scryfall_id = formData.scryfall_id;
      }

      if (formData.purchase_price !== '') {
        body.purchase_price = parseFloat(formData.purchase_price);
      } else {
        body.purchase_price = null;
      }

      body.notes = formData.notes.trim() || null;

      const response = await authFetch(
        `/collections/${collectionId}/entries/${entry.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to update entry');
        return;
      }

      toaster.push(
        <Message type="success" showIcon closable>
          <strong>{entry.name}</strong> updated
        </Message>,
        { placement: 'topCenter', duration: 3000 }
      );

      handleClose();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  if (!entry) return null;

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <Modal.Header>
        <Modal.Title>Edit Entry</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p style={{ marginBottom: 16 }}>
          Editing <strong>{entry.name}</strong>
        </p>

        {error && (
          <Message type="error" showIcon style={{ marginBottom: 16 }}>
            {error}
          </Message>
        )}

        <Form fluid>
          <Form.Group>
            <Form.ControlLabel>Quantity</Form.ControlLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ButtonGroup>
                <Button onClick={() => adjustQuantity(-1)} disabled={formData.quantity <= 1}>
                  −
                </Button>
                <Button onClick={() => adjustQuantity(1)}>+</Button>
              </ButtonGroup>
              <InputNumber
                value={formData.quantity}
                onChange={(value) => setField('quantity', parseInt(value, 10) || 1)}
                min={1}
                max={999}
                style={{ flex: 1 }}
              />
            </div>
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
              key={`finish-${entry?.id}`}
              data={FINISH_OPTIONS}
              value={formData.finish}
              onChange={(value) => setField('finish', value)}
              searchable={false}
              block
              placeholder="Select finish"
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
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleClose} appearance="subtle">
          Cancel
        </Button>
        <Button onClick={handleSubmit} appearance="primary" loading={submitting}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EditEntryModal;
