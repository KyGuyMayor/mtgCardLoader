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
  RadioGroup,
  Radio,
  Progress,
  useToaster,
} from 'rsuite';
import authFetch from '../../helpers/authFetch';

const { Column, HeaderCell, Cell } = Table;

const FORMAT_DECKBOX = 'Deckbox';
const FORMAT_MOXFIELD = 'Moxfield';
const FORMAT_UNKNOWN = 'Unknown';

const CONDITION_MAP = {
  'mint': 'MINT',
  'm': 'MINT',
  'near mint': 'NM',
  'nm': 'NM',
  'lightly played': 'LP',
  'lp': 'LP',
  'good (lightly played)': 'LP',
  'moderately played': 'MP',
  'mp': 'MP',
  'played': 'MP',
  'heavily played': 'HP',
  'hp': 'HP',
  'damaged': 'DAMAGED',
  'd': 'DAMAGED',
  'dm': 'DAMAGED',
};

function normalizeCondition(raw) {
  if (!raw) return 'NM';
  const mapped = CONDITION_MAP[raw.trim().toLowerCase()];
  return mapped || 'NM';
}

function normalizeFinish(raw) {
  if (!raw) return 'nonfoil';
  const lower = raw.trim().toLowerCase();
  if (lower === 'foil' || lower === 'yes' || lower === '1' || lower === 'true') {
    return 'foil';
  }
  if (lower === 'etched') {
    return 'etched';
  }
  return 'nonfoil';
}

function parseCSVRows(text) {
  let cleaned = text.replace(/^\uFEFF/, '');

  const rows = [];
  let i = 0;
  const len = cleaned.length;

  while (i < len) {
    const row = [];
    while (i < len) {
      let cell = '';

      if (i < len && cleaned[i] === '"') {
        i++;
        while (i < len) {
          if (cleaned[i] === '"') {
            if (i + 1 < len && cleaned[i + 1] === '"') {
              cell += '"';
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            cell += cleaned[i];
            i++;
          }
        }
      } else {
        while (i < len && cleaned[i] !== ',' && cleaned[i] !== '\t' && cleaned[i] !== '\r' && cleaned[i] !== '\n') {
          cell += cleaned[i];
          i++;
        }
      }

      row.push(cell);

      if (i < len && (cleaned[i] === ',' || cleaned[i] === '\t')) {
        i++;
      } else {
        break;
      }
    }

    if (i < len && cleaned[i] === '\r') i++;
    if (i < len && cleaned[i] === '\n') i++;

    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function detectFormat(headers) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const hasPurchasePrice = lower.includes('purchase price');
  const hasCollectorNumber = lower.includes('collector number');
  const hasTradelistCount = lower.includes('tradelist count');
  const hasType = lower.includes('type');
  const hasRarity = lower.includes('rarity');

  if (hasTradelistCount || (hasType && hasRarity && !hasPurchasePrice)) {
    return FORMAT_DECKBOX;
  }
  if (hasPurchasePrice || hasCollectorNumber) {
    return FORMAT_MOXFIELD;
  }
  if (lower.includes('count') && lower.includes('name')) {
    return FORMAT_MOXFIELD;
  }
  if (lower.includes('qty') && lower.includes('name')) {
    return FORMAT_MOXFIELD;
  }
  return FORMAT_UNKNOWN;
}

function headerIndex(headers, ...names) {
  for (const name of names) {
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCards(headers, rows) {
  const iCount = headerIndex(headers, 'count', 'qty', 'quantity');
  const iName = headerIndex(headers, 'name', 'card name', 'card');
  const iEdition = headerIndex(headers, 'edition', 'set', 'set code', 'set_code');
  const iCondition = headerIndex(headers, 'condition');
  const iPrice = headerIndex(headers, 'purchase price', 'price', 'my price');
  const iFoil = headerIndex(headers, 'foil');

  if (iName < 0) return [];

  return rows.map((row, idx) => {
    const countRaw = iCount >= 0 ? row[iCount] : '1';
    const count = parseInt(countRaw, 10) || 1;
    const name = (iName >= 0 ? row[iName] || '' : '').trim();
    const edition = iEdition >= 0 ? (row[iEdition] || '').trim().toLowerCase() : '';
    const condition = iCondition >= 0 ? normalizeCondition(row[iCondition]) : 'NM';
    const priceStr = iPrice >= 0 ? (row[iPrice] || '') : '';
    const price = priceStr ? parseFloat(priceStr.replace(/[^0-9.]/g, '')) : null;
    const finish = iFoil >= 0 ? normalizeFinish(row[iFoil]) : 'nonfoil';

    return {
      _idx: idx,
      count,
      name,
      edition,
      condition,
      finish,
      purchase_price: price != null && !isNaN(price) && price > 0 ? price : null,
      status: 'pending',
      scryfall_id: null,
    };
  }).filter((c) => c.name);
}

const STATUS_COLORS = {
  pending: '#888',
  matched: '#2ecc71',
  unmatched: '#e74c3c',
  skipped: '#f39c12',
};

const StatusCell = ({ rowData, ...props }) => (
  <Cell {...props}>
    <span style={{ color: STATUS_COLORS[rowData.status] || '#888' }}>
      {rowData.status === 'matched' ? '✓ Matched' :
       rowData.status === 'unmatched' ? '✗ Not Found' :
       rowData.status === 'skipped' ? '— Skipped' : '…'}
    </span>
  </Cell>
);

const ImportCSVModal = ({ open, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [parsedCards, setParsedCards] = useState([]);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [destinationMode, setDestinationMode] = useState('existing');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('upload');
  const [matchProgress, setMatchProgress] = useState(0);
  const [matching, setMatching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collectionId, setCollectionId] = useState(null);
  const cancelRef = useRef(false);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
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
    setFile(null);
    setDetectedFormat(null);
    setParsedCards([]);
    setError('');
    setSelectedCollection(null);
    setDestinationMode('existing');
    setNewCollectionName('');
    setStep('upload');
    setMatchProgress(0);
    setMatching(false);
    setImporting(false);
    setCollectionId(null);
    onClose();
  };

  const processFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv') && !f.name.toLowerCase().endsWith('.txt')) {
      setError('Please select a CSV file');
      return;
    }
    setError('');
    setFile(f);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const allRows = parseCSVRows(text);
        if (allRows.length < 2) {
          setError('CSV file is empty or has no data rows');
          return;
        }
        const headers = allRows[0];
        const dataRows = allRows.slice(1);
        const format = detectFormat(headers);
        setDetectedFormat(format);
        const cards = parseCards(headers, dataRows);
        if (cards.length === 0) {
          setError('No valid card entries found. Check that your CSV has a "Name" column.');
          return;
        }
        setParsedCards(cards);
      } catch (err) {
        setError('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(f);
  };

  const handleFileChange = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    processFile(e.dataTransfer.files[0]);
  };

  const matchCards = async (cards, targetCollectionId) => {
    setMatching(true);
    setMatchProgress(0);
    cancelRef.current = false;
    const updated = [...cards];

    const CHUNK = 75;
    for (let i = 0; i < updated.length; i += CHUNK) {
      if (cancelRef.current) return;
      const chunk = updated.slice(i, i + CHUNK);
      const identifiers = chunk.map((c) => {
        // For double-sided cards, use only the front face name for Scryfall matching
        // e.g., "Delver of Secrets // Insectile Aberration" becomes "Delver of Secrets"
        const cardName = c.name.includes(' // ') ? c.name.split(' // ')[0] : c.name;
        
        if (c.edition) {
          return { name: cardName, set: c.edition };
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

          const foundMap = {};
           found.forEach((card) => {
             const key = card.name.toLowerCase();
             if (!foundMap[key]) foundMap[key] = card;
             
             // For double-sided cards, also index by individual face names
             // e.g., "Delver of Secrets // Insectile Aberration" also indexes as "Delver of Secrets" and "Insectile Aberration"
             if (card.name.includes(' // ')) {
               const faces = card.name.split(' // ');
               faces.forEach((face) => {
                 const faceKey = face.toLowerCase();
                 if (!foundMap[faceKey]) foundMap[faceKey] = card;
               });
             }
           });

          chunk.forEach((c, ci) => {
            const globalIdx = i + ci;
            const cardName = c.name.toLowerCase();
            const match = foundMap[cardName];
            if (match) {
              updated[globalIdx] = { ...updated[globalIdx], status: 'matched', scryfall_id: match.id };
            } else {
              updated[globalIdx] = { ...updated[globalIdx], status: 'unmatched' };
            }
          });
        } else {
          chunk.forEach((_, ci) => {
            updated[i + ci] = { ...updated[i + ci], status: 'unmatched' };
          });
        }
      } catch (err) {
        chunk.forEach((_, ci) => {
          updated[i + ci] = { ...updated[i + ci], status: 'unmatched' };
        });
      }

      const progress = Math.min(100, Math.round(((i + chunk.length) / updated.length) * 100));
      setMatchProgress(progress);
      setParsedCards([...updated]);

      if (i + CHUNK < updated.length) {
        await new Promise((r) => setTimeout(r, 100));
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
    let imported = 0;
    let failed = 0;

    // Bulk import in chunks of 500 cards per request
    const CHUNK_SIZE = 500;
    for (let i = 0; i < toImport.length; i += CHUNK_SIZE) {
      const chunk = toImport.slice(i, i + CHUNK_SIZE);
      const entries = chunk.map((card) => ({
        scryfall_id: card.scryfall_id,
        quantity: card.count,
        condition: card.condition,
        finish: card.finish || 'nonfoil',
        purchase_price: card.purchase_price || null,
      }));

      try {
        const res = await authFetch(`/collections/${collectionId}/entries/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        });

        if (res.ok || res.status === 201) {
          const data = await res.json();
          imported += data.imported || chunk.length;
        } else {
          failed += chunk.length;
        }
      } catch (err) {
        failed += chunk.length;
      }

      // Small delay between chunks to avoid overwhelming server
      if (i + CHUNK_SIZE < toImport.length) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    setImporting(false);

    toaster.push(
      <Message type="success" showIcon closable>
        Imported {imported} card{imported !== 1 ? 's' : ''}
        {failed > 0 ? ` (${failed} failed)` : ''}
      </Message>,
      { placement: 'topCenter', duration: 4000 }
    );

    if (onImported) onImported({ collectionId });
    handleClose();
  };

  const handleContinue = async () => {
    setError('');
    let targetId = selectedCollection;

    if (destinationMode === 'new') {
      setSubmitting(true);
      try {
        const res = await authFetch('/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCollectionName.trim(), type: 'TRADE_BINDER' }),
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

  const collectionOptions = collections.map((c) => ({
    label: `${c.name} (${c.type === 'DECK' ? 'Deck' : 'Trade Binder'})`,
    value: c.id,
  }));

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <Modal.Header>
        <Modal.Title>
          {step === 'upload' ? 'Import from CSV' : 'Match & Import Cards'}
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
            {!file && (
              <div
                ref={dropRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #555',
                  borderRadius: 8,
                  padding: 40,
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: '#aaa',
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 16, marginBottom: 8 }}>
                  Drag and drop a CSV file here, or click to browse
                </p>
                <p style={{ fontSize: 13 }}>Supports Deckbox and Moxfield formats</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            )}

            {file && detectedFormat && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ color: '#aaa' }}>File: <strong style={{ color: '#fff' }}>{file.name}</strong></span>
                  <Badge content={detectedFormat} />
                  <Badge content={`${parsedCards.length} cards`} />
                  <Button size="xs" appearance="ghost" onClick={() => { setFile(null); setParsedCards([]); setDetectedFormat(null); setError(''); }}>
                    Change File
                  </Button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <RadioGroup
                    inline
                    value={destinationMode}
                    onChange={setDestinationMode}
                    style={{ marginBottom: 12 }}
                  >
                    <Radio value="existing">Existing collection</Radio>
                    <Radio value="new">Create new collection</Radio>
                  </RadioGroup>

                  {destinationMode === 'existing' ? (
                    loadingCollections ? (
                      <Loader content="Loading collections..." />
                    ) : (
                      <SelectPicker
                        data={collectionOptions}
                        value={selectedCollection}
                        onChange={setSelectedCollection}
                        searchable={false}
                        block
                        placeholder="Select destination collection"
                      />
                    )
                  ) : (
                    <Input
                      value={newCollectionName}
                      onChange={setNewCollectionName}
                      placeholder="New collection name"
                    />
                  )}
                </div>

                {parsedCards.length > 0 && (
                  <Table
                    data={parsedCards.slice(0, 50)}
                    height={250}
                    virtualized
                    rowHeight={40}
                  >
                    <Column flexGrow={2}>
                      <HeaderCell>Name</HeaderCell>
                      <Cell dataKey="name" />
                    </Column>
                    <Column width={60}>
                      <HeaderCell>Qty</HeaderCell>
                      <Cell dataKey="count" />
                    </Column>
                    <Column width={70}>
                      <HeaderCell>Set</HeaderCell>
                      <Cell dataKey="edition" />
                    </Column>
                    <Column width={80}>
                      <HeaderCell>Cond.</HeaderCell>
                      <Cell dataKey="condition" />
                    </Column>
                    <Column width={80}>
                      <HeaderCell>Price</HeaderCell>
                      <Cell>
                        {(rowData) =>
                          rowData.purchase_price != null
                            ? `$${rowData.purchase_price.toFixed(2)}`
                            : ''
                        }
                      </Cell>
                    </Column>
                  </Table>
                )}
                {parsedCards.length > 50 && (
                  <p style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                    Showing first 50 of {parsedCards.length} cards
                  </p>
                )}
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
              height={350}
              virtualized
              rowHeight={40}
            >
              <Column flexGrow={2}>
                <HeaderCell>Name</HeaderCell>
                <Cell dataKey="name" />
              </Column>
              <Column width={60}>
                <HeaderCell>Qty</HeaderCell>
                <Cell dataKey="count" />
              </Column>
              <Column width={70}>
                <HeaderCell>Set</HeaderCell>
                <Cell dataKey="edition" />
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
        {step === 'upload' && (
          <Button
            appearance="primary"
            disabled={
              !parsedCards.length ||
              (destinationMode === 'existing' && !selectedCollection) ||
              (destinationMode === 'new' && !newCollectionName.trim())
            }
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

export default ImportCSVModal;
