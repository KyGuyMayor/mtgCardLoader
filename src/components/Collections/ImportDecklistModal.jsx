import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Button,
  SelectPicker,
  Table,
  Message,
  Loader,
  Badge,
  Input,
  Progress,
  useToaster,
} from 'rsuite';
import authFetch from '../../helpers/authFetch';
import { parseDecklistText, isDecklistText } from '../../helpers/decklistParser';
import { SCRYFALL_CHUNK_SIZE, SCRYFALL_DELAY_MS, TOAST_DURATION, STATUS_COLORS, StatusCell, getFrontFaceName, buildScryfallFoundMap, bulkImportEntries } from '../../helpers/importUtils';
import { DeckTypeSelector } from './CollectionTypeSelectors';

const { Column, HeaderCell, Cell } = Table;

const PREVIEW_LIMIT = 50;
const TABLE_HEIGHT = 300;
const TABLE_ROW_HEIGHT = 40;

const SECTION_BADGE_COLORS = {
  Commander: '#e67e22',
  Companion: '#9b59b6',
  Deck: '#3498db',
  Sideboard: '#27ae60',
  Maybeboard: '#95a5a6',
};

const PLACEHOLDER_TEXT = `Paste your decklist here. Supported formats:

Commander
1 Atraxa, Praetors' Voice (CM2) 10

Deck
1 Sol Ring (C21) 263
4 Counterspell (CMR) 632
1x Lightning Bolt

Sideboard
1 Rest in Peace (AKR) 33`;

const SectionCell = ({ rowData, ...props }) => (
  <Cell {...props}>
    <span style={{ color: SECTION_BADGE_COLORS[rowData.section] || '#888' }}>
      {rowData.section}
    </span>
  </Cell>
);

const ImportDecklistModal = ({ open, onClose, onImported }) => {
  const [decklistText, setDecklistText] = useState('');
  const [parsedCards, setParsedCards] = useState([]);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [destinationMode, setDestinationMode] = useState('new');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDeckType, setNewCollectionDeckType] = useState('OTHER');
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('upload');
  const [matchProgress, setMatchProgress] = useState(0);
  const [matching, setMatching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collectionId, setCollectionId] = useState(null);
  const [file, setFile] = useState(null);
  const cancelRef = useRef(false);
  const fileInputRef = useRef(null);
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
      // silent
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleClose = () => {
    cancelRef.current = true;
    setDecklistText('');
    setParsedCards([]);
    setError('');
    setSelectedCollection(null);
    setDestinationMode('new');
    setNewCollectionName('');
    setNewCollectionDeckType('OTHER');
    setStep('upload');
    setMatchProgress(0);
    setMatching(false);
    setImporting(false);
    setCollectionId(null);
    setFile(null);
    onClose();
  };

  const processText = (text) => {
    if (!text.trim()) {
      setParsedCards([]);
      return;
    }

    if (!isDecklistText(text)) {
      setError('This doesn\'t look like a decklist. Expected lines like "1 Sol Ring" or "4 Counterspell (CMR) 632".');
      setParsedCards([]);
      return;
    }

    setError('');
    const result = parseDecklistText(text);

    if (result.allCards.length === 0) {
      setError('No valid card entries found in the decklist.');
      setParsedCards([]);
      return;
    }

    // Auto-detect deck type from sections
    const hasCommander = result.sections.some((s) => s.name === 'Commander');
    if (hasCommander) {
      setNewCollectionDeckType('COMMANDER');
    }

    const cards = result.allCards.map((card, idx) => ({
      _idx: idx,
      name: card.name,
      quantity: card.quantity,
      set: card.set || '',
      collectorNumber: card.collectorNumber || '',
      foil: card.foil,
      section: card.section,
      finish: card.foil ? 'foil' : 'nonfoil',
      status: card.section === 'Maybeboard' ? 'skipped' : 'pending',
      scryfall_id: null,
    }));

    setParsedCards(cards);
  };

  const handleTextChange = (value) => {
    setDecklistText(value);
    processText(value);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.txt')) {
      setError('Please select a .txt file');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setDecklistText(text);
      processText(text);
    };
    reader.readAsText(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.txt')) {
      setError('Please select a .txt file');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setDecklistText(text);
      processText(text);
    };
    reader.readAsText(f);
  };

  const matchCards = async (cards, targetCollectionId) => {
    setMatching(true);
    setMatchProgress(0);
    cancelRef.current = false;
    const updated = [...cards];

    // Only match non-skipped cards
    const toMatch = updated.filter((c) => c.status !== 'skipped');

    for (let i = 0; i < toMatch.length; i += SCRYFALL_CHUNK_SIZE) {
      if (cancelRef.current) return;
      const chunk = toMatch.slice(i, i + SCRYFALL_CHUNK_SIZE);

      const identifiers = chunk.map((c) => {
        // For double-sided cards, use only the front face name
        const cardName = getFrontFaceName(c.name);

        // Prefer set+collector_number for precise matching
        if (c.set && c.collectorNumber) {
          return { set: c.set, collector_number: c.collectorNumber };
        }
        if (c.set) {
          return { name: cardName, set: c.set };
        }
        return { name: cardName };
      });

      try {
        const res = await fetch('/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers }),
        });

        if (res.ok) {
          const data = await res.json();
          const found = data.data || [];

          const foundMap = buildScryfallFoundMap(found);

          chunk.forEach((c) => {
            const globalIdx = c._idx;
            let match = null;

            // Try set+collector match first
            if (c.set && c.collectorNumber) {
              match = foundMap[`${c.set}|${c.collectorNumber}`];
            }
            // Fall back to name match
            if (!match) {
              const cardName = c.name.toLowerCase();
              match = foundMap[cardName];
            }

            if (match) {
              updated[globalIdx] = { ...updated[globalIdx], status: 'matched', scryfall_id: match.id };
            } else {
              updated[globalIdx] = { ...updated[globalIdx], status: 'unmatched' };
            }
          });
        } else {
          chunk.forEach((c) => {
            updated[c._idx] = { ...updated[c._idx], status: 'unmatched' };
          });
        }
      } catch (err) {
        chunk.forEach((c) => {
          updated[c._idx] = { ...updated[c._idx], status: 'unmatched' };
        });
      }

      const progress = Math.min(100, Math.round(((i + chunk.length) / toMatch.length) * 100));
      setMatchProgress(progress);
      setParsedCards([...updated]);

      if (i + SCRYFALL_CHUNK_SIZE < toMatch.length) {
        await new Promise((r) => setTimeout(r, SCRYFALL_DELAY_MS));
      }
    }

    setMatching(false);
    setCollectionId(targetCollectionId);
  };

  const handleSkip = (idx) => {
    setParsedCards((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: 'skipped' };
      return next;
    });
  };

  const handleConfirmImport = async () => {
    const toImport = parsedCards.filter((c) => c.status === 'matched');
    if (toImport.length === 0) {
      setError('No matched cards to import');
      return;
    }

    setImporting(true);
    setError('');

    // Aggregate cards by (scryfall_id, condition, finish) to sum quantities
    const aggregateMap = {};
    toImport.forEach((card) => {
      const finish = card.finish || 'nonfoil';
      const isCommander = card.section === 'Commander';
      const isSideboard = card.section === 'Sideboard' || card.section === 'Companion';
      const key = `${card.scryfall_id}|NM|${finish}|${isCommander}|${isSideboard}`;
      if (!aggregateMap[key]) {
        aggregateMap[key] = {
          scryfall_id: card.scryfall_id,
          condition: 'NM',
          finish,
          quantity: 0,
          is_commander: false,
          is_sideboard: false,
          notes: null,
        };
      }
      aggregateMap[key].quantity += card.quantity;

      // Section-aware flags
      if (card.section === 'Commander') {
        aggregateMap[key].is_commander = true;
      }
      if (card.section === 'Sideboard') {
        aggregateMap[key].is_sideboard = true;
      }
      if (card.section === 'Companion') {
        aggregateMap[key].is_sideboard = true;
        aggregateMap[key].notes = 'Companion';
      }
    });

    const aggregatedEntries = Object.values(aggregateMap);

    const entries = aggregatedEntries.map((card) => ({
      scryfall_id: card.scryfall_id,
      quantity: card.quantity,
      condition: card.condition,
      finish: card.finish,
      is_commander: card.is_commander,
      is_sideboard: card.is_sideboard,
      notes: card.notes,
    }));

    const result = await bulkImportEntries(collectionId, entries);
    let imported = result.imported;
    let failed = result.failed;

    setImporting(false);

    toaster.push(
      <Message type="success" showIcon closable>
        Imported {imported} card{imported !== 1 ? 's' : ''}
        {failed > 0 ? ` (${failed} failed)` : ''}
      </Message>,
      { placement: 'topCenter', duration: TOAST_DURATION }
    );

    if (onImported) onImported({ collectionId });
    handleClose();
  };

  const handleContinue = async () => {
    setError('');
    let targetId = selectedCollection;

    if (destinationMode === 'new') {
      if (!newCollectionName.trim()) {
        setError('Please enter a collection name');
        return;
      }
      setSubmitting(true);
      try {
        const payload = {
          name: newCollectionName.trim(),
          type: 'DECK',
          deck_type: newCollectionDeckType,
        };
        const res = await authFetch('/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to create collection');
          setSubmitting(false);
          return;
        }
        const created = await res.json();
        targetId = created.id;
      } catch (err) {
        setError('Unable to connect to server');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    setStep('match');
    matchCards(parsedCards, targetId);
  };

  const matchedCount = parsedCards.filter((c) => c.status === 'matched').length;
  const unmatchedCount = parsedCards.filter((c) => c.status === 'unmatched').length;
  const skippedCount = parsedCards.filter((c) => c.status === 'skipped').length;
  const pendingCount = parsedCards.filter((c) => c.status === 'pending').length;

  const collectionOptions = collections
    .filter((c) => c.type === 'DECK')
    .map((c) => ({
      label: `${c.name} (${c.deck_type || 'Deck'})`,
      value: c.id,
    }));

  const canContinue =
    parsedCards.length > 0 &&
    (parsedCards.length - skippedCount) > 0 &&
    (
      (destinationMode === 'existing' && selectedCollection) ||
      (destinationMode === 'new' && newCollectionName.trim())
    );

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <Modal.Header>
        <Modal.Title>
          {step === 'upload' ? 'Import Decklist' : 'Match & Import Cards'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Message type="error" showIcon style={{ marginBottom: 16 }}>
            {error}
          </Message>
        )}

        {step === 'upload' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{
                  border: '2px dashed #555',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Input
                  as="textarea"
                  rows={10}
                  value={decklistText}
                  onChange={handleTextChange}
                  placeholder={PLACEHOLDER_TEXT}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    backgroundColor: 'transparent',
                    border: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  size="xs"
                  appearance="ghost"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload .txt File
                </Button>
                {file && (
                  <span style={{ color: '#aaa', fontSize: 12 }}>
                    {file.name}
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {parsedCards.length > 0 && (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Badge content={`${parsedCards.length} cards parsed`} />
                  {skippedCount > 0 && (
                    <Badge content={`${skippedCount} maybeboard (skipped)`} style={{ backgroundColor: '#95a5a6' }} />
                  )}
                </div>

                <Table
                  data={parsedCards.slice(0, PREVIEW_LIMIT)}
                  height={TABLE_HEIGHT}
                  virtualized
                  rowHeight={TABLE_ROW_HEIGHT}
                >
                  <Column width={90}>
                    <HeaderCell>Section</HeaderCell>
                    <SectionCell dataKey="section" />
                  </Column>
                  <Column width={50}>
                    <HeaderCell>Qty</HeaderCell>
                    <Cell dataKey="quantity" />
                  </Column>
                  <Column flexGrow={2}>
                    <HeaderCell>Name</HeaderCell>
                    <Cell dataKey="name" />
                  </Column>
                  <Column width={60}>
                    <HeaderCell>Set</HeaderCell>
                    <Cell dataKey="set" />
                  </Column>
                  <Column width={80}>
                    <HeaderCell>Status</HeaderCell>
                    <StatusCell dataKey="status" />
                  </Column>
                </Table>
                {parsedCards.length > PREVIEW_LIMIT && (
                  <p style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                    Showing first {PREVIEW_LIMIT} of {parsedCards.length} cards
                  </p>
                )}

                <div style={{ marginTop: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <Button
                      size="sm"
                      appearance={destinationMode === 'new' ? 'primary' : 'ghost'}
                      onClick={() => setDestinationMode('new')}
                    >
                      Create new deck
                    </Button>
                    <Button
                      size="sm"
                      appearance={destinationMode === 'existing' ? 'primary' : 'ghost'}
                      onClick={() => setDestinationMode('existing')}
                    >
                      Existing deck
                    </Button>
                  </div>

                  {destinationMode === 'new' ? (
                    <>
                      <Input
                        value={newCollectionName}
                        onChange={setNewCollectionName}
                        placeholder="Deck name"
                        style={{ marginBottom: 12 }}
                      />
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Deck Type</label>
                        <DeckTypeSelector
                          value={newCollectionDeckType}
                          onChange={setNewCollectionDeckType}
                        />
                      </div>
                    </>
                  ) : (
                    loadingCollections ? (
                      <Loader content="Loading decks..." />
                    ) : (
                      <SelectPicker
                        data={collectionOptions}
                        value={selectedCollection}
                        onChange={setSelectedCollection}
                        searchable={false}
                        block
                        placeholder="Select destination deck"
                      />
                    )
                  )}
                </div>
              </>
            )}
          </>
        )}

        {step === 'match' && (
          <>
            {matching && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ marginBottom: 8 }}>Matching cards with Scryfall...</p>
                <Progress.Line percent={matchProgress} status="active" />
              </div>
            )}

            {!matching && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <Badge content={`${matchedCount} matched`} style={{ backgroundColor: '#2ecc71' }} />
                {unmatchedCount > 0 && (
                  <Badge content={`${unmatchedCount} not found`} style={{ backgroundColor: '#e74c3c' }} />
                )}
                {skippedCount > 0 && (
                  <Badge content={`${skippedCount} skipped`} style={{ backgroundColor: '#f39c12' }} />
                )}
              </div>
            )}

            <Table
              data={parsedCards}
              height={TABLE_HEIGHT + 50}
              virtualized
              rowHeight={TABLE_ROW_HEIGHT}
            >
              <Column width={90}>
                <HeaderCell>Section</HeaderCell>
                <SectionCell dataKey="section" />
              </Column>
              <Column flexGrow={2}>
                <HeaderCell>Name</HeaderCell>
                <Cell dataKey="name" />
              </Column>
              <Column width={50}>
                <HeaderCell>Qty</HeaderCell>
                <Cell dataKey="quantity" />
              </Column>
              <Column width={60}>
                <HeaderCell>Set</HeaderCell>
                <Cell dataKey="set" />
              </Column>
              <Column width={110}>
                <HeaderCell>Status</HeaderCell>
                <StatusCell dataKey="status" />
              </Column>
              <Column width={70}>
                <HeaderCell />
                <Cell>
                  {(rowData) =>
                    rowData.status === 'unmatched' ? (
                      <Button
                        size="xs"
                        appearance="ghost"
                        onClick={() => handleSkip(rowData._idx)}
                      >
                        Skip
                      </Button>
                    ) : null
                  }
                </Cell>
              </Column>
            </Table>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleClose} appearance="subtle">
          Cancel
        </Button>
        {step === 'upload' && parsedCards.length > 0 && (
          <Button
            appearance="primary"
            disabled={!canContinue}
            loading={submitting}
            onClick={handleContinue}
          >
            Continue to Match
          </Button>
        )}
        {step === 'match' && !matching && (
          <Button
            appearance="primary"
            disabled={matchedCount === 0}
            loading={importing}
            onClick={handleConfirmImport}
          >
            Import {matchedCount} Card{matchedCount !== 1 ? 's' : ''}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ImportDecklistModal;
