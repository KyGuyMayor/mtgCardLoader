import React from 'react';
import { Table, Tooltip, Whisper } from 'rsuite';
import { FINISH_LABELS, FINISH_COLORS } from './CardAttributeDefaults';

const { Cell } = Table;

const COLORS = {
  muted: '#aaa',
  gain: '#2ecc71',
  loss: '#e74c3c',
};

export const GainLossCell = ({ rowData, ...props }) => {
  const val = rowData?.gain_loss_raw;
  if (val == null) return <Cell {...props} />;
  const color = val > 0 ? COLORS.gain : val < 0 ? COLORS.loss : COLORS.muted;
  const prefix = val > 0 ? '+' : '';
  return (
    <Cell {...props}>
      <span style={{ color }}>{prefix}${val.toFixed(2)}</span>
    </Cell>
  );
};

export const FinishCell = ({ rowData, ...props }) => {
  const finish = rowData?.finish || 'nonfoil';
  const label = FINISH_LABELS[finish] || 'Non-Foil';
  const color = FINISH_COLORS[finish] || '#aaa';
  return (
    <Cell {...props}>
      <span style={{ color }}>{label}</span>
    </Cell>
  );
};

export const NameCell = ({ rowData, errorMap, warningMap, deckType, ...props }) => {
  const scryfallId = rowData?.scryfall_id;
  const error = scryfallId ? errorMap[scryfallId] : null;
  const warning = scryfallId ? warningMap[scryfallId] : null;
  const violation = error || warning;
  const isCommander = rowData?.is_commander;
  const isSignatureSpell = rowData?.is_signature_spell;
  const isOathbreaker = deckType === 'OATHBREAKER';

  // Badge styles
  const badgeBaseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 'bold',
    borderRadius: '50%',
    flexShrink: 0,
  };

  return (
    <Cell {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {violation && (
          <Whisper
            placement="top"
            controlId={`violation-${scryfallId}`}
            speaker={
              <Tooltip>
                <div style={{ maxWidth: 250 }}>
                  <strong>{violation.type}:</strong> {violation.message}
                </div>
              </Tooltip>
            }
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: error ? '#e74c3c' : '#f39c12',
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {error ? '✕' : '⚠'}
            </span>
          </Whisper>
        )}
        {isOathbreaker && isCommander && (
          <span
            style={{
              ...badgeBaseStyle,
              width: 20,
              height: 20,
              backgroundColor: '#9b59b6',
              color: '#fff',
            }}
            title="Oathbreaker"
          >
            OB
          </span>
        )}
        {isOathbreaker && isSignatureSpell && (
          <span
            style={{
              ...badgeBaseStyle,
              width: 20,
              height: 20,
              backgroundColor: '#3498db',
              color: '#fff',
            }}
            title="Signature Spell"
          >
            SS
          </span>
        )}
        {!isOathbreaker && isCommander && (
          <span
            style={{
              ...badgeBaseStyle,
              width: 20,
              height: 20,
              backgroundColor: '#f1c40f',
              color: '#000',
            }}
            title="Commander"
          >
            ♛
          </span>
        )}
        <span>{rowData?.name || 'Unknown Card'}</span>
      </div>
    </Cell>
  );
};
