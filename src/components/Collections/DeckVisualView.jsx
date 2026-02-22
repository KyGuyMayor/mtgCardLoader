import React, { useState, useMemo, useCallback, useRef } from 'react';
import { isMobile } from 'react-device-detect';
import './DeckVisualView.css';

const TYPE_ORDER = [
  'Creature',
  'Planeswalker',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
  'Other',
];

const getCardPrimaryType = (typeLine) => {
  if (!typeLine) return 'Other';
  for (const type of TYPE_ORDER) {
    if (type === 'Other') continue;
    if (typeLine.includes(type)) return type;
  }
  return 'Other';
};

// Scryfall image dimensions (small size)
const SCRYFALL_SMALL_WIDTH = 146;
const SCRYFALL_SMALL_HEIGHT = 204;

// Visual stack layout
const CARD_SCALE = isMobile ? 0.7 : 1;

const COLORS = {
  dropHighlight: '#3498db',
  dropHighlightBg: 'rgba(52, 152, 219, 0.1)',
};
const Z_INDEX = { dropOverlay: 100 };
const BORDER_RADIUS = 4;
const CARD_WIDTH = Math.round(SCRYFALL_SMALL_WIDTH * CARD_SCALE);
const CARD_HEIGHT = Math.round(SCRYFALL_SMALL_HEIGHT * CARD_SCALE);
const CARD_OFFSET = isMobile ? 20 : 30;
const MOBILE_STACK_MAX_HEIGHT = 500;

// Mana curve bar chart
const MANA_BAR_MAX_HEIGHT = 80;
const MANA_BAR_MIN_VISIBLE = 4;
const CMC_BUCKET_COUNT = 8;
const CMC_MAX_INDEX = 7;
const CMC_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7+'];

// Hover preview
const PREVIEW_IMG_WIDTH = 244;
const PREVIEW_IMG_HEIGHT = 340;
const PREVIEW_PANEL_WIDTH = 300;
const PREVIEW_ESTIMATED_HEIGHT = 400;
const PREVIEW_GAP = 16;
const PREVIEW_EDGE_MARGIN = 10;
const PREVIEW_TOP_OFFSET = 100;

// Timing
const PREVIEW_DISMISS_DELAY_MS = 50;

const ManaCurve = ({ sortedData, isDeck }) => {
  const cmcData = useMemo(() => {
    if (!isDeck) return null;
    const buckets = new Array(CMC_BUCKET_COUNT).fill(0);
    sortedData.forEach((entry) => {
      const type = getCardPrimaryType(entry.type_line);
      if (type === 'Land') return;
      const cmc = Math.floor(entry.cmc || 0);
      const qty = entry.quantity || 1;
      const idx = Math.min(cmc, CMC_MAX_INDEX);
      buckets[idx] += qty;
    });
    return buckets;
  }, [sortedData, isDeck]);

  if (!cmcData) return null;
  const maxCount = Math.max(...cmcData, 1);

  return (
    <div className="dvv-mana-curve">
      <h5>Mana Curve</h5>
      <div className={`dvv-mana-bars ${isMobile ? 'dvv-mana-bars--mobile' : 'dvv-mana-bars--desktop'}`}>
        {cmcData.map((count, idx) => {
          const barHeight = maxCount > 0 ? Math.max((count / maxCount) * MANA_BAR_MAX_HEIGHT, count > 0 ? MANA_BAR_MIN_VISIBLE : 0) : 0;
          return (
            <div key={idx} className="dvv-mana-bucket">
              <span className="dvv-mana-count">{count > 0 ? count : ''}</span>
              <div className="dvv-mana-bar" style={{ height: barHeight }} />
              <span className="dvv-mana-label">{CMC_LABELS[idx]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CardImage = ({ entry, navigate, onPreview, onClearPreview }) => {
  const handleClick = useCallback(() => {
    if (entry.scryfall_id) {
      navigate(`/cardsearch/${entry.scryfall_id}`);
    }
  }, [entry.scryfall_id, navigate]);

  const handleMouseEnter = useCallback((e) => {
    if (!isMobile && entry.image_normal) {
      const rect = e.currentTarget.getBoundingClientRect();
      onPreview(entry, rect);
    }
  }, [entry, onPreview]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile) {
      onClearPreview();
    }
  }, [onClearPreview]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const [tapped, setTapped] = useState(false);
  const handleTouchEnd = useCallback((e) => {
    if (!isMobile) return;
    e.preventDefault();
    if (!tapped && entry.image_normal) {
      setTapped(true);
      onPreview(entry, e.currentTarget.getBoundingClientRect());
    } else {
      setTapped(false);
      onClearPreview();
      handleClick();
    }
  }, [tapped, entry, onPreview, onClearPreview, handleClick]);

  return (
    <div
      className="dvv-card-image"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      role="button"
      tabIndex={0}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={!isMobile ? handleClick : undefined}
      onKeyDown={!isMobile ? handleKeyDown : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      {entry.image_small ? (
        <img
          src={entry.image_small}
          alt={entry.name}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          className="dvv-card-img"
          loading="lazy"
        />
      ) : (
        <div className="dvv-card-placeholder" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          {entry.name}
        </div>
      )}
      {(entry.quantity || 1) > 1 && (
        <span className="dvv-qty-badge">x{entry.quantity}</span>
      )}
    </div>
  );
};

const CardImageMemo = React.memo(CardImage);

const HoverPreview = ({ entry, position }) => {
  const [normalLoaded, setNormalLoaded] = useState(false);

  if (!entry || !position) return null;

  const previewLeft = position.right + PREVIEW_GAP;
  const fitsRight = previewLeft + PREVIEW_PANEL_WIDTH < window.innerWidth;
  const previewTop = Math.min(
    Math.max(PREVIEW_EDGE_MARGIN, position.top - PREVIEW_TOP_OFFSET),
    window.innerHeight - PREVIEW_ESTIMATED_HEIGHT - PREVIEW_EDGE_MARGIN
  );

  return (
    <div
      className="dvv-preview"
      style={{
        left: fitsRight ? previewLeft : position.left - PREVIEW_PANEL_WIDTH - PREVIEW_GAP,
        top: previewTop,
      }}
    >
      {!normalLoaded && entry.image_small && (
        <img
          src={entry.image_small}
          alt={entry.name}
          width={PREVIEW_IMG_WIDTH}
          height={PREVIEW_IMG_HEIGHT}
          className="dvv-card-img"
        />
      )}
      {entry.image_normal && (
        <img
          src={entry.image_normal}
          alt={entry.name}
          width={PREVIEW_IMG_WIDTH}
          height={PREVIEW_IMG_HEIGHT}
          className="dvv-card-img"
          style={{ display: normalLoaded ? 'block' : 'none' }}
          onLoad={() => setNormalLoaded(true)}
        />
      )}
      <div className="dvv-preview-info">
        <div className="dvv-preview-name">{entry.name}</div>
        <div className="dvv-preview-type">{entry.type_line}</div>
        {entry.current_price && (
          <div className="dvv-preview-price">{entry.current_price}</div>
        )}
      </div>
    </div>
  );
};

const DeckVisualView = ({ sortedData, collection, navigate, onCardDrop }) => {
  const [previewEntry, setPreviewEntry] = useState(null);
  const [previewPosition, setPreviewPosition] = useState(null);
  const [dragOverActive, setDragOverActive] = useState(false);
  const clearTimerRef = useRef(null);

  const handlePreview = useCallback((entry, rect) => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setPreviewEntry(entry);
    setPreviewPosition(rect);
  }, []);

  const handleClearPreview = useCallback(() => {
    clearTimerRef.current = setTimeout(() => {
      setPreviewEntry(null);
      setPreviewPosition(null);
    }, PREVIEW_DISMISS_DELAY_MS);
  }, []);

  const typeGroups = useMemo(() => {
    const groups = {};
    TYPE_ORDER.forEach((type) => { groups[type] = []; });

    sortedData.forEach((entry) => {
      const type = getCardPrimaryType(entry.type_line);
      groups[type].push(entry);
    });

    return TYPE_ORDER
      .filter((type) => groups[type].length > 0)
      .map((type) => ({
        type,
        label: type === 'Other' ? 'Other' : type + 's',
        cards: groups[type],
        totalCount: groups[type].reduce((sum, e) => sum + (e.quantity || 1), 0),
      }));
  }, [sortedData]);

  const isDeck = collection?.type === 'DECK';

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverActive(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverActive(false);
    if (onCardDrop) {
      onCardDrop(e);
    }
  };

  return (
    <div>
      <ManaCurve sortedData={sortedData} isDeck={isDeck} />

      <div 
        className={`dvv-grid ${isMobile ? 'dvv-grid--mobile' : 'dvv-grid--desktop'}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ position: 'relative' }}
      >
        {typeGroups.map(({ type, label, cards, totalCount }) => (
          <div key={type} className="dvv-type-group">
            <div className="dvv-type-header">
              {label} ({totalCount})
            </div>
            <div
              className="dvv-stack"
              style={{
                height: CARD_HEIGHT + (cards.length - 1) * CARD_OFFSET,
                maxHeight: isMobile ? MOBILE_STACK_MAX_HEIGHT : undefined,
                overflowY: isMobile ? 'auto' : undefined,
              }}
            >
              {cards.map((entry, idx) => (
                <div
                   key={`${entry.id || entry.scryfall_id}-${idx}`}
                   className="dvv-stack-card"
                   style={{ top: idx * CARD_OFFSET, zIndex: idx }}
                 >
                   <CardImageMemo
                     entry={entry}
                     navigate={navigate}
                     onPreview={handlePreview}
                     onClearPreview={handleClearPreview}
                   />
                 </div>
              ))}
            </div>
          </div>
        ))}
        {dragOverActive && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: `2px dashed ${COLORS.dropHighlight}`,
            backgroundColor: COLORS.dropHighlightBg,
            borderRadius: BORDER_RADIUS,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_INDEX.dropOverlay,
            pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center', color: COLORS.dropHighlight, fontWeight: 'bold' }}>
              📎 Drop card here
            </div>
          </div>
        )}
        </div>

        <HoverPreview entry={previewEntry} position={previewPosition} />
        </div>
  );
};

export default DeckVisualView;
