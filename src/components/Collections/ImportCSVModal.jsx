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
import { SCRYFALL_CHUNK_SIZE, SCRYFALL_DELAY_MS, TOAST_DURATION, STATUS_COLORS, StatusCell, getFrontFaceName, buildScryfallFoundMap, bulkImportEntries } from '../../helpers/importUtils';
import { CollectionTypeSelector, DeckTypeSelector } from './CollectionTypeSelectors';

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

function parseCards(headers, rows, customMapping = null) {
  let iCount, iName, iEdition, iCondition, iPrice, iFoil, iNotes;

  if (customMapping) {
    // Use custom column mapping
    iCount = customMapping.quantity;
    iName = customMapping.name;
    iEdition = customMapping.set;
    iCondition = customMapping.condition;
    iPrice = customMapping.purchase_price;
    iFoil = customMapping.foil;
    iNotes = customMapping.notes;
  } else {
    // Auto-detect from headers
    iCount = headerIndex(headers, 'count', 'qty', 'quantity');
    iName = headerIndex(headers, 'name', 'card name', 'card');
    iEdition = headerIndex(headers, 'edition', 'set', 'set code', 'set_code');
    iCondition = headerIndex(headers, 'condition');
    iPrice = headerIndex(headers, 'purchase price', 'price', 'my price');
    iFoil = headerIndex(headers, 'foil');
    iNotes = headerIndex(headers, 'notes');
  }

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
    const notes = iNotes >= 0 ? (row[iNotes] || '').trim() : '';

    return {
      _idx: idx,
      count,
      name,
      edition,
      condition,
      finish,
      notes,
      purchase_price: price != null && !isNaN(price) && price > 0 ? price : null,
      status: 'pending',
      scryfall_id: null,
    };
  }).filter((c) => c.name);
}

const ImportCSVModal = ({ open, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [parsedCards, setParsedCards] = useState([]);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [destinationMode, setDestinationMode] = useState('existing');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionType, setNewCollectionType] = useState('TRADE_BINDER');
  const [newCollectionDeckType, setNewCollectionDeckType] = useState('COMMANDER');
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('upload');
  const [matchProgress, setMatchProgress] = useState(0);
  const [matching, setMatching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collectionId, setCollectionId] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvDataRows, setCsvDataRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    name: -1,
    quantity: -1,
    set: -1,
    condition: -1,
    purchase_price: -1,
    foil: -1,
    notes: -1,
  });
  const [forceGenericMapping, setForceGenericMapping] = useState(false);
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
    setNewCollectionType('TRADE_BINDER');
    setNewCollectionDeckType('COMMANDER');
    setStep('upload');
    setMatchProgress(0);
    setMatching(false);
    setImporting(false);
    setCollectionId(null);
    setCsvHeaders([]);
    setCsvDataRows([]);
    setColumnMapping({
      name: -1,
      quantity: -1,
      set: -1,
      condition: -1,
      purchase_price: -1,
      foil: -1,
      notes: -1,
    });
    setForceGenericMapping(false);
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
        setCsvHeaders(headers);
        setCsvDataRows(dataRows);
        setForceGenericMapping(false);

        // If format is unknown, don't auto-parse yet — wait for column mapping
        if (format === FORMAT_UNKNOWN) {
          // Initialize column mapping from localStorage if available
          const savedMapping = localStorage.getItem('csvColumnMapping');
          if (savedMapping) {
            try {
              const parsed = JSON.parse(savedMapping);
              setColumnMapping(parsed);
              // Auto-apply saved mapping if name column is set
              if (parsed.name >= 0) {
                applyColumnMapping(parsed, headers, dataRows);
              }
            } catch (err) {
              // Ignore invalid JSON
            }
          }
          return;
        }

        // For known formats, auto-parse immediately
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

  const applyColumnMapping = (mapping, headers, dataRows) => {
    // Validate that name column is set
    if (mapping.name < 0) {
      setError('Name column is required');
      return;
    }

    // Parse cards with the custom mapping
    const cards = parseCards(headers, dataRows, mapping);
    if (cards.length === 0) {
      setError('No valid card entries found with the selected column mapping.');
      return;
    }

    // Save mapping to localStorage for future use
    localStorage.setItem('csvColumnMapping', JSON.stringify(mapping));

    setParsedCards(cards);
    setError('');
    // Keep on upload step but show collection selection mode now
  };

  const matchCards = async (cards, targetCollectionId) => {
    setMatching(true);
    setMatchProgress(0);
    cancelRef.current = false;
    const updated = [...cards];

    // Using SCRYFALL_CHUNK_SIZE from importUtils
    for (let i = 0; i < updated.length; i += SCRYFALL_CHUNK_SIZE) {
      if (cancelRef.current) return;
      const chunk = updated.slice(i, i + SCRYFALL_CHUNK_SIZE);
      const identifiers = chunk.map((c) => {
        const cardName = getFrontFaceName(c.name);
        
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

          const foundMap = buildScryfallFoundMap(found);

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

      if (i + SCRYFALL_CHUNK_SIZE < updated.length) {
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
      const key = `${card.scryfall_id}|${card.condition}|${card.finish || 'nonfoil'}`;
      if (!aggregateMap[key]) {
        aggregateMap[key] = {
          scryfall_id: card.scryfall_id,
          condition: card.condition,
          finish: card.finish || 'nonfoil',
          quantity: 0,
          purchase_price: card.purchase_price || null,
          notes: card.notes || null,
        };
      }
      aggregateMap[key].quantity += card.count;
      if (!aggregateMap[key].purchase_price && card.purchase_price) {
        aggregateMap[key].purchase_price = card.purchase_price;
      }
      if (!aggregateMap[key].notes && card.notes) {
        aggregateMap[key].notes = card.notes;
      }
    });

    const aggregatedEntries = Object.values(aggregateMap);

    const entries = aggregatedEntries.map((card) => ({
      scryfall_id: card.scryfall_id,
      quantity: card.quantity,
      condition: card.condition,
      finish: card.finish,
      purchase_price: card.purchase_price,
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
       setSubmitting(true);
       try {
         const payload = { name: newCollectionName.trim(), type: newCollectionType };
         if (newCollectionType === 'DECK') {
           payload.deck_type = newCollectionDeckType;
         }
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

            {file && detectedFormat && !forceGenericMapping && detectedFormat !== FORMAT_UNKNOWN && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ color: '#aaa' }}>File: <strong style={{ color: '#fff' }}>{file.name}</strong></span>
                  <Badge content={detectedFormat} />
                  <Badge content={`${parsedCards.length} cards`} />
                  <Button size="xs" appearance="ghost" onClick={() => { setFile(null); setParsedCards([]); setDetectedFormat(null); setError(''); }}>
                    Change File
                  </Button>
                  <Button size="xs" appearance="ghost" onClick={() => { setForceGenericMapping(true); setParsedCards([]); }}>
                    Use Column Mapping
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

            {file && (detectedFormat === FORMAT_UNKNOWN || forceGenericMapping) && csvHeaders.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ color: '#aaa' }}>File: <strong style={{ color: '#fff' }}>{file.name}</strong></span>
                  <Badge content="Generic CSV" />
                  <Button size="xs" appearance="ghost" onClick={() => { setFile(null); setParsedCards([]); setDetectedFormat(null); setError(''); setCsvHeaders([]); setCsvDataRows([]); }}>
                    Change File
                  </Button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ marginBottom: 8 }}>Map CSV Columns</h4>
                  <p style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>Select which CSV column contains each field. Name is required.</p>
                  
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Name <span style={{ color: '#e74c3c' }}>*</span></label>
                    <SelectPicker
                      data={[
                        { label: 'Select column...', value: -1 },
                        ...csvHeaders.map((h, i) => ({ label: h, value: i })),
                      ]}
                      value={columnMapping.name}
                      onChange={(val) => setColumnMapping({ ...columnMapping, name: val })}
                      block
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Quantity (optional)</label>
                    <SelectPicker
                      data={[
                        { label: 'None', value: -1 },
                        ...csvHeaders.map((h, i) => ({ label: h, value: i })),
                      ]}
                      value={columnMapping.quantity}
                      onChange={(val) => setColumnMapping({ ...columnMapping, quantity: val })}
                      block
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Set/Edition (optional)</label>
                    <SelectPicker
                      data={[
                        { label: 'None', value: -1 },
                        ...csvHeaders.map((h, i) => ({ label: h, value: i })),
                      ]}
                      value={columnMapping.set}
                      onChange={(val) => setColumnMapping({ ...columnMapping, set: val })}
                      block
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Condition (optional)</label>
                    <SelectPicker
                      data={[
                        { label: 'None', value: -1 },
                        ...csvHeaders.map((h, i) => ({ label: h, value: i })),
                      ]}
                      value={columnMapping.condition}
                      onChange={(val) => setColumnMapping({ ...columnMapping, condition: val })}
                      block
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Purchase Price (optional)</label>
                    <SelectPicker
                      data={[
                        { label: 'None', value: -1 },
                        ...csvHeaders.map((h, i) => ({ label: h, value: i })),
                      ]}
                      value={columnMapping.purchase_price}
                      onChange={(val) => setColumnMapping({ ...columnMapping, purchase_price: val })}
                      block
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Foil (optional)</label>
                    <SelectPicker
                      data={[
                        { label: 'None', value: -1 },
                        ...csvHeaders.map((h, i) => ({ label: h, value: i })),
                      ]}
                      value={columnMapping.foil}
                      onChange={(val) => setColumnMapping({ ...columnMapping, foil: val })}
                      block
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Notes (optional)</label>
                    <SelectPicker
                      data={[
                        { label: 'None', value: -1 },
                        ...csvHeaders.map((h, i) => ({ label: h, value: i })),
                      ]}
                      value={columnMapping.notes}
                      onChange={(val) => setColumnMapping({ ...columnMapping, notes: val })}
                      block
                    />
                  </div>
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
                    <>
                      <Input
                        value={newCollectionName}
                        onChange={setNewCollectionName}
                        placeholder="New collection name"
                        style={{ marginBottom: 12 }}
                      />

                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Collection Type</label>
                        <CollectionTypeSelector
                          value={newCollectionType}
                          onChange={setNewCollectionType}
                        />
                      </div>

                      {newCollectionType === 'DECK' && (
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ccc' }}>Deck Type</label>
                          <DeckTypeSelector
                            value={newCollectionDeckType}
                            onChange={setNewCollectionDeckType}
                          />
                        </div>
                      )}
                    </>
                  )}
                  </div>

                  {csvDataRows.length > 0 && (
                  <>
                    <h4 style={{ marginBottom: 8 }}>Preview ({Math.min(csvDataRows.length, 50)} of {csvDataRows.length} rows)</h4>
                    <Table
                      data={csvDataRows.slice(0, 50)}
                      height={250}
                      virtualized
                      rowHeight={40}
                    >
                      {csvHeaders.map((header, idx) => (
                        <Column key={idx} width={120}>
                          <HeaderCell>{header}</HeaderCell>
                          <Cell dataKey={idx.toString()} />
                        </Column>
                      ))}
                      </Table>
                      </>
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
        {step === 'upload' && file && (detectedFormat === FORMAT_UNKNOWN || forceGenericMapping) && csvHeaders.length > 0 && parsedCards.length === 0 && (
          <Button
            appearance="primary"
            disabled={columnMapping.name < 0}
            onClick={() => applyColumnMapping(columnMapping, csvHeaders, csvDataRows)}
          >
            Apply Mapping
          </Button>
        )}
        {step === 'upload' && parsedCards.length > 0 && (
          <Button
            appearance="primary"
            disabled={
              (destinationMode === 'existing' && !selectedCollection) ||
              (destinationMode === 'new' && (!newCollectionName.trim() || !newCollectionType || (newCollectionType === 'DECK' && !newCollectionDeckType)))
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
