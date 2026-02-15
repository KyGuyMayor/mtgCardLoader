import React, { useState } from 'react';
import {
  Modal,
  Button,
  RadioGroup,
  Radio,
} from 'rsuite';

const FORMAT_DECKBOX = 'deckbox';
const FORMAT_MOXFIELD = 'moxfield';

const DECKBOX_HEADERS = ['Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil', 'Tags', 'My Price'];

const MOXFIELD_HEADERS = ['Count', 'Name', 'Edition', 'Condition', 'Purchase Price', 'Section'];

function escapeCSV(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function mapConditionDeckbox(condition) {
  const map = {
    'MINT': 'Mint',
    'NM': 'Near Mint',
    'LP': 'Lightly Played',
    'MP': 'Moderately Played',
    'HP': 'Heavily Played',
    'DAMAGED': 'Damaged',
  };
  return map[condition] || 'Near Mint';
}

function mapConditionMoxfield(condition) {
  const map = {
    'MINT': 'Mint',
    'NM': 'Near Mint',
    'LP': 'Lightly Played',
    'MP': 'Moderately Played',
    'HP': 'Heavily Played',
    'DAMAGED': 'Damaged',
  };
  return map[condition] || 'Near Mint';
}

function buildCSV(entries, format) {
  const rows = [];

  if (format === FORMAT_DECKBOX) {
    rows.push(DECKBOX_HEADERS.map(escapeCSV).join(','));
    entries.forEach((entry) => {
      rows.push([
        entry.quantity || 1,
        escapeCSV(entry.name || ''),
        escapeCSV(entry.set_name || ''),
        escapeCSV(mapConditionDeckbox(entry.condition)),
        'English',
        '',
        entry.is_sideboard ? 'Sideboard' : '',
        entry.purchase_price_raw != null ? entry.purchase_price_raw.toFixed(2) : '',
      ].join(','));
    });
  } else {
    rows.push(MOXFIELD_HEADERS.map(escapeCSV).join(','));
    entries.forEach((entry) => {
      rows.push([
        entry.quantity || 1,
        escapeCSV(entry.name || ''),
        escapeCSV(entry.set_name || ''),
        escapeCSV(mapConditionMoxfield(entry.condition)),
        entry.purchase_price_raw != null ? entry.purchase_price_raw.toFixed(2) : '',
        entry.is_sideboard ? 'sideboard' : 'mainboard',
      ].join(','));
    });
  }

  return rows.join('\n');
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const ExportCSVModal = ({ open, onClose, collectionName, entries }) => {
  const [format, setFormat] = useState(FORMAT_MOXFIELD);

  const handleExport = () => {
    const csvContent = buildCSV(entries, format);
    const safeName = (collectionName || 'collection').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_${format}.csv`;
    downloadCSV(csvContent, filename);
    onClose();
  };

  const handleClose = () => {
    setFormat(FORMAT_MOXFIELD);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} size="xs">
      <Modal.Header>
        <Modal.Title>Export Collection</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p style={{ marginBottom: 16, color: '#aaa' }}>
          Export <strong style={{ color: '#fff' }}>{collectionName}</strong> ({entries?.length || 0} entries) to CSV.
        </p>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 13, color: '#aaa', marginBottom: 8, display: 'block' }}>Format</label>
          <RadioGroup value={format} onChange={setFormat}>
            <Radio value={FORMAT_MOXFIELD}>Moxfield</Radio>
            <Radio value={FORMAT_DECKBOX}>Deckbox</Radio>
          </RadioGroup>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleClose} appearance="subtle">
          Cancel
        </Button>
        <Button
          appearance="primary"
          onClick={handleExport}
          disabled={!entries || entries.length === 0}
        >
          Export CSV
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ExportCSVModal;
