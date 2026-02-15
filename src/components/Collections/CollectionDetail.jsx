import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import {
  CustomProvider,
  Container,
  Content,
  Table,
  Loader,
  Message,
  Badge,
  Button,
  ButtonGroup,
  Modal,
  useToaster,
  Panel,
  Progress,
  Tooltip,
  Whisper,
} from 'rsuite';
import { ArrowDown } from '@rsuite/icons';

import NavigationBar from '../Shared/NavigationBar';
import EditEntryModal from './EditEntryModal';
import CollectionFilters from './CollectionFilters';
import ExportCSVModal from './ExportCSVModal';
import authFetch from '../../helpers/authFetch';
import { DECK_FORMAT_RULES } from '../../helpers/deckRules';
import './CollectionDetail.css';

const { Column, HeaderCell, Cell } = Table;

const BADGE_COLORS = {
  DECK: '#3498db',
  TRADE_BINDER: '#2ecc71',
};

const BADGE_LABELS = {
  DECK: 'Deck',
  TRADE_BINDER: 'Trade Binder',
};

const SPACING = {
  containerMaxWidth: 1100,
  containerPadding: 16,
  containerMarginTop: 30,
  headerMarginBottom: 20,
  emptyPadding: 60,
  statsGap: 16,
};

const COLORS = {
  muted: '#aaa',
  gain: '#2ecc71',
  loss: '#e74c3c',
};

const GainLossCell = ({ rowData, ...props }) => {
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

const RARITY_ORDER = {
  'common': 0,
  'uncommon': 1,
  'rare': 2,
  'mythic': 3,
};

const CONDITION_ORDER = {
  'MINT': 0,
  'NM': 1,
  'LP': 2,
  'MP': 3,
  'HP': 4,
  'DAMAGED': 5,
};

const defaultColumns = [
  { key: 'name', label: 'Name', fixed: true, flexGrow: 2, sortable: true },
  { key: 'type_line', label: 'Type', flexGrow: 1, sortable: true },
];

const desktopColumns = [
  { key: 'rarity', label: 'Rarity', flexGrow: 1, sortable: true },
  { key: 'colors', label: 'Colors', flexGrow: 1 },
  { key: 'set_name', label: 'Set', flexGrow: 1 },
  { key: 'purchase_price_display', label: 'Purchase Price', flexGrow: 1, sortable: true, sortKey: 'purchase_price_raw' },
  { key: 'current_price', label: 'Current Price', flexGrow: 1, sortable: true, sortKey: 'current_price_raw' },
  { key: 'gain_loss', label: 'Gain/Loss', flexGrow: 1, custom: true },
  { key: 'condition', label: 'Condition', flexGrow: 1, sortable: true },
];

const quantityColumn = { key: 'quantity', label: 'Quantity', width: 90, sortable: true };

const NameCell = ({ rowData, errorMap, warningMap, ...props }) => {
  const scryfallId = rowData?.scryfall_id;
  const error = scryfallId ? errorMap[scryfallId] : null;
  const warning = scryfallId ? warningMap[scryfallId] : null;
  const violation = error || warning;

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
        <span>{rowData?.name || 'Unknown Card'}</span>
      </div>
    </Cell>
  );
};

const CollectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [colorFilter, setColorFilter] = useState([]);
  const [rarityFilter, setRarityFilter] = useState([]);
  const [conditionFilter, setConditionFilter] = useState([]);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortType, setSortType] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [paginationProgress, setPaginationProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [deckSection, setDeckSection] = useState('all');
  const priceCacheRef = useRef({});
  const toaster = useToaster();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const formatRules = collection ? DECK_FORMAT_RULES[collection.deck_type] : null;
  const hasSideboard = collection?.type === 'DECK' && formatRules?.sideboardSize != null && formatRules?.sideboardSize > 0;

  const mainDeckCards = tableData.filter(e => !e.is_sideboard).reduce((sum, e) => sum + (e.quantity || 0), 0);
  const sideboardCards = tableData.filter(e => e.is_sideboard).reduce((sum, e) => sum + (e.quantity || 0), 0);

  const enrichEntries = (entries, cards) => entries.map((entry, idx) => {
    const card = cards[idx];
    const usdPrice = card?.prices?.usd || card?.prices?.usd_foil || null;
    const currentRaw = usdPrice ? Number(usdPrice) : null;
    const purchaseRaw = entry.purchase_price != null ? Number(entry.purchase_price) : null;
    const gainLossRaw = (purchaseRaw != null && currentRaw != null)
      ? currentRaw - purchaseRaw
      : null;
    const rawColors = card?.colors || [];
    return {
      ...entry,
      name: card?.name || 'Unknown Card',
      type_line: card?.type_line || '',
      rarity: card?.rarity || '',
      colors_raw: rawColors,
      colors: rawColors.join(', ') || 'Colorless',
      set_name: card?.set_name || '',
      purchase_price_display: purchaseRaw != null
        ? `$${purchaseRaw.toFixed(2)}`
        : '',
      current_price: currentRaw != null ? `$${currentRaw.toFixed(2)}` : '',
      current_price_raw: currentRaw,
      purchase_price_raw: purchaseRaw,
      gain_loss_raw: gainLossRaw,
    };
  });

  const fetchCardsBatch = async (scryfallIds) => {
    const cache = priceCacheRef.current;
    const uncachedIds = scryfallIds.filter((sid) => !cache[sid]);

    if (uncachedIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < uncachedIds.length; i += 75) {
        chunks.push(uncachedIds.slice(i, i + 75));
      }

      for (const chunk of chunks) {
        const identifiers = chunk.map((sid) => ({ id: sid }));
        try {
          const res = await fetch('/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              data.data.forEach((card) => {
                cache[card.id] = card;
              });
            }
          }
        } catch (err) {
          // batch fetch failed
        }

      }
    }

    return scryfallIds.map((sid) => cache[sid] || null);
  };

  useEffect(() => {
    const fetchCollection = async () => {
      setLoading(true);
      setError('');
      setTableData([]);
      setPaginationProgress(0);
      setTotalPages(0);
      setCurrentPageNum(1);

      try {
        // Fetch first page
        const firstResponse = await authFetch(`/collections/${id}?limit=100&page=1`);
        if (!isMountedRef.current) return;
        if (!firstResponse.ok) {
          if (firstResponse.status === 404) {
            setError('Collection not found');
          } else if (firstResponse.status === 403) {
            setError('You do not have access to this collection');
          } else {
            setError('Failed to load collection');
          }
          return;
        }
        const firstData = await firstResponse.json();
        if (!isMountedRef.current) return;

        setCollection(firstData);
        const totalPagesCount = firstData.pagination?.totalPages || 1;
        setTotalPages(totalPagesCount);

        if (firstData.entries && firstData.entries.length > 0) {
          setCardLoading(true);
          setPriceLoading(true);

          // Show first page immediately without Scryfall enrichment
          const basicData = firstData.entries.map((entry) => ({
            ...entry,
            name: 'Unknown Card',
            type_line: '',
            rarity: '',
            colors_raw: [],
            colors: 'Colorless',
            set_name: '',
            purchase_price_display: entry.purchase_price != null
              ? `$${Number(entry.purchase_price).toFixed(2)}`
              : '',
            current_price: '',
            current_price_raw: null,
            purchase_price_raw: entry.purchase_price != null ? Number(entry.purchase_price) : null,
            gain_loss_raw: null,
          }));
          setTableData(basicData);
          // Hide loading spinner - table is now visible with basic data
          if (isMountedRef.current) setLoading(false);

          // Enrich first page in background
          const scryfallIds = firstData.entries.map((e) => e.scryfall_id);
          const cards = await fetchCardsBatch(scryfallIds);
          if (!isMountedRef.current) return;

          const enriched = enrichEntries(firstData.entries, cards);

          setTableData(enriched);
          if (isMountedRef.current) {
            setPaginationProgress(1 / totalPagesCount);
            setCurrentPageNum(1);
          }

          // Fetch remaining pages in background
          if (totalPagesCount > 1) {
            let allEnrichedData = enriched;

            for (let page = 2; page <= totalPagesCount; page++) {
              if (!isMountedRef.current) break;

              try {
                const pageResponse = await authFetch(`/collections/${id}?limit=100&page=${page}`);
                if (!pageResponse.ok) break;

                const pageData = await pageResponse.json();
                if (!isMountedRef.current) break;

                if (pageData.entries && pageData.entries.length > 0) {
                  // Enrich this page
                  const pageIds = pageData.entries.map((e) => e.scryfall_id);
                  const pageCards = await fetchCardsBatch(pageIds);
                  if (!isMountedRef.current) break;

                  const pageEnriched = enrichEntries(pageData.entries, pageCards);

                  // Append to table data
                  allEnrichedData = allEnrichedData.concat(pageEnriched);
                  if (isMountedRef.current) {
                    setTableData(allEnrichedData);
                    setPaginationProgress(page / totalPagesCount);
                    setCurrentPageNum(page);
                  }
                }
              } catch (err) {
                // Page fetch failed, continue with what we have
                console.error(`Failed to fetch page ${page}:`, err.message);
                if (isMountedRef.current) {
                  toaster.push(
                    <Message type="warning" showIcon closable>
                      Failed to load page {page} — showing available data
                    </Message>,
                    { placement: 'topCenter', duration: 3000 }
                  );
                }
              }
            }

            setCardLoading(false);
            setPriceLoading(false);
          } else {
            setCardLoading(false);
            setPriceLoading(false);
          }
        }
      } catch (err) {
        if (isMountedRef.current) setError('Unable to connect to server');
      } finally {
        // Ensure loading is hidden if error occurred before first page was displayed
        if (isMountedRef.current) setLoading(false);
      }
    };

    fetchCollection();
  }, [id, refreshKey, toaster]);

  const filteredData = useMemo(() => {
    let data = tableData;

    if (hasSideboard) {
      if (deckSection === 'main') {
        data = data.filter((row) => !row.is_sideboard);
      } else if (deckSection === 'side') {
        data = data.filter((row) => row.is_sideboard);
      }
    }

    if (nameSearch) {
      const term = nameSearch.toLowerCase();
      data = data.filter((row) => row.name.toLowerCase().includes(term));
    }

    if (colorFilter.length > 0) {
      data = data.filter((row) => {
        const raw = row.colors_raw || [];
        return colorFilter.some((f) => {
          if (f === 'C') return raw.length === 0;
          if (f === 'M') return raw.length > 1;
          return raw.includes(f);
        });
      });
    }

    if (rarityFilter.length > 0) {
      data = data.filter((row) => rarityFilter.includes(row.rarity));
    }

    if (conditionFilter.length > 0) {
      data = data.filter((row) => conditionFilter.includes(row.condition));
    }

    return data;
  }, [tableData, nameSearch, colorFilter, rarityFilter, conditionFilter, deckSection, hasSideboard]);

  const stats = useMemo(() => {
    if (tableData.length === 0) {
      return {
        totalCardCount: 0,
        totalPurchaseValue: 0,
        colorBreakdown: {},
        rarityBreakdown: {},
        top10MostValuableCards: [],
      };
    }

    let totalCardCount = 0;
    let totalPurchaseValue = 0;
    const colorBreakdown = {};
    const rarityBreakdown = {};
    const cardsByPrice = [];

    tableData.forEach((row) => {
      const quantity = row.quantity || 1;

      // Total card count
      totalCardCount += quantity;

      // Total purchase value
      if (row.purchase_price_raw != null) {
        totalPurchaseValue += row.purchase_price_raw * quantity;
      }

      // Color breakdown
      const colors = row.colors_raw || [];
      let colorKey;
      if (colors.length === 0) {
        colorKey = 'Colorless';
      } else if (colors.length === 1) {
        colorKey = colors[0];
      } else {
        colorKey = 'Multicolor';
      }
      colorBreakdown[colorKey] = (colorBreakdown[colorKey] || 0) + quantity;

      // Rarity breakdown
      const rarity = row.rarity ? row.rarity.charAt(0).toUpperCase() + row.rarity.slice(1) : 'Unknown';
      rarityBreakdown[rarity] = (rarityBreakdown[rarity] || 0) + quantity;

      // Top 10 most valuable
      if (row.purchase_price_raw != null) {
        cardsByPrice.push({
          name: row.name,
          scryfall_id: row.scryfall_id,
          quantity: quantity,
          purchasePrice: row.purchase_price_raw,
          totalValue: row.purchase_price_raw * quantity,
        });
      }
    });

    // Get top 10 most valuable cards
    const top10MostValuableCards = cardsByPrice
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    return {
      totalCardCount,
      totalPurchaseValue: Math.round(totalPurchaseValue * 100) / 100,
      colorBreakdown,
      rarityBreakdown,
      top10MostValuableCards,
    };
  }, [tableData]);

  const allColumns = useMemo(() => (
    isMobile
      ? [...defaultColumns, quantityColumn]
      : [...defaultColumns, ...desktopColumns, quantityColumn]
  ), []);

  const handleSortColumn = (dataKey) => {
    const colDef = allColumns.find((c) => c.key === dataKey);
    const resolvedKey = colDef?.sortKey || dataKey;

    if (sortColumn === resolvedKey) {
      if (sortType === 'asc') {
        setSortType('desc');
      } else if (sortType === 'desc') {
        setSortColumn(null);
        setSortType(null);
      } else {
        setSortType('asc');
      }
    } else {
      setSortColumn(resolvedKey);
      setSortType('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortType) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (sortColumn === 'rarity') {
        const aRank = RARITY_ORDER[(aVal || '').toLowerCase()] ?? 99;
        const bRank = RARITY_ORDER[(bVal || '').toLowerCase()] ?? 99;
        return sortType === 'asc' ? aRank - bRank : bRank - aRank;
      }

      if (sortColumn === 'condition') {
        const aRank = CONDITION_ORDER[aVal] ?? 99;
        const bRank = CONDITION_ORDER[bVal] ?? 99;
        return sortType === 'asc' ? aRank - bRank : bRank - aRank;
      }

      if (typeof aVal === 'number' || typeof bVal === 'number') {
        const an = aVal ?? -Infinity;
        const bn = bVal ?? -Infinity;
        return sortType === 'asc' ? an - bn : bn - an;
      }

      const as = (aVal || '').toString();
      const bs = (bVal || '').toString();
      return sortType === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [filteredData, sortColumn, sortType]);

  const displaySortColumn = useMemo(() => {
    if (!sortColumn) return null;
    const col = allColumns.find((c) => (c.sortKey || c.key) === sortColumn);
    return col ? col.key : sortColumn;
  }, [sortColumn, allColumns]);

  // Build maps of scryfall_id -> error/warning info for highlighting
  const validationHighlights = useMemo(() => {
    const errorMap = {}; // scryfall_id -> { type, message }
    const warningMap = {}; // scryfall_id -> { type, message }

    if (!validationResult) {
      return { errorMap, warningMap };
    }

    if (validationResult.errors && Array.isArray(validationResult.errors)) {
      validationResult.errors.forEach((error) => {
        if (error.cards && Array.isArray(error.cards)) {
          error.cards.forEach((card) => {
            if (card.scryfall_id) {
              errorMap[card.scryfall_id] = {
                type: error.type,
                message: error.message,
              };
            }
          });
        }
      });
    }

    if (validationResult.warnings && Array.isArray(validationResult.warnings)) {
      validationResult.warnings.forEach((warning) => {
        if (warning.cards && Array.isArray(warning.cards)) {
          warning.cards.forEach((card) => {
            if (card.scryfall_id) {
              warningMap[card.scryfall_id] = {
                type: warning.type,
                message: warning.message,
              };
            }
          });
        }
      });
    }

    return { errorMap, warningMap };
  }, [validationResult]);

  const priceSummary = useMemo(() => {
    if (tableData.length === 0) {
      return {
        withPurchase: [],
        totalPurchase: 0,
        totalCurrent: 0,
        trackable: [],
        trackablePurchase: 0,
        trackableCurrent: 0,
        totalGainLoss: 0,
        glColor: COLORS.muted,
        glPrefix: '',
      };
    }

    const withPurchase = tableData.filter((r) => r.purchase_price_raw != null);
    const totalPurchase = withPurchase.reduce((s, r) => s + r.purchase_price_raw * (r.quantity || 1), 0);
    const totalCurrent = tableData.reduce((s, r) => s + (r.current_price_raw || 0) * (r.quantity || 1), 0);
    const trackable = withPurchase.filter((r) => r.current_price_raw != null);
    const trackablePurchase = trackable.reduce((s, r) => s + r.purchase_price_raw * (r.quantity || 1), 0);
    const trackableCurrent = trackable.reduce((s, r) => s + r.current_price_raw * (r.quantity || 1), 0);
    const totalGainLoss = trackableCurrent - trackablePurchase;
    const glColor = totalGainLoss > 0 ? COLORS.gain : totalGainLoss < 0 ? COLORS.loss : COLORS.muted;
    const glPrefix = totalGainLoss > 0 ? '+' : '';

    return {
      withPurchase,
      totalPurchase,
      totalCurrent,
      trackable,
      trackablePurchase,
      trackableCurrent,
      totalGainLoss,
      glColor,
      glPrefix,
    };
  }, [tableData]);

  const handleClearFilters = () => {
    setNameSearch('');
    setColorFilter([]);
    setRarityFilter([]);
    setConditionFilter([]);
    setSortColumn(null);
    setSortType(null);
    setDeckSection('all');
  };

  const handleRowClick = (rowData) => {
    if (rowData.scryfall_id) {
      navigate(`/cardsearch/${rowData.scryfall_id}`);
    }
  };

  const handleEdit = (rowData, e) => {
    e.stopPropagation();
    setEditEntry(rowData);
    setEditModalOpen(true);
  };

  const handleEditClose = () => {
    setEditModalOpen(false);
    setEditEntry(null);
  };

  const handleEntryUpdated = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleDeleteClick = (rowData, e) => {
    e.stopPropagation();
    setDeleteEntry(rowData);
    setDeleteModalOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteModalOpen(false);
    setDeleteEntry(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      const response = await authFetch(
        `/collections/${id}/entries/${deleteEntry.id}`,
        { method: 'DELETE' }
      );
      if (response.ok || response.status === 204) {
        toaster.push(
          <Message type="success" showIcon closable>
            <strong>{deleteEntry.name}</strong> removed from collection
          </Message>,
          { placement: 'topCenter', duration: 3000 }
        );
        handleDeleteClose();
        setRefreshKey((k) => k + 1);
      } else {
        const data = await response.json();
        toaster.push(
          <Message type="error" showIcon closable>
            {data.error || 'Failed to delete entry'}
          </Message>,
          { placement: 'topCenter', duration: 4000 }
        );
      }
    } catch (err) {
      toaster.push(
        <Message type="error" showIcon closable>
          Unable to connect to server
        </Message>,
        { placement: 'topCenter', duration: 4000 }
      );
    } finally {
      setDeleting(false);
    }
  };

  const ActionsCell = ({ rowData, ...props }) => (
    <Cell {...props} style={{ padding: '6px 0' }}>
      <Button
        size="xs"
        appearance="ghost"
        onClick={(e) => handleEdit(rowData, e)}
      >
        Edit
      </Button>
      <Button
        size="xs"
        appearance="ghost"
        color="red"
        onClick={(e) => handleDeleteClick(rowData, e)}
        style={{ marginLeft: 4 }}
      >
        Del
      </Button>
    </Cell>
  );

  const actionsColumn = { key: 'actions', label: '', width: 120, custom: 'actions' };

  const columns = [...allColumns, actionsColumn];

  const typeBadge = (type) => (
    <span
      style={{
        backgroundColor: BADGE_COLORS[type],
        color: '#fff',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        marginLeft: 8,
      }}
    >
      {BADGE_LABELS[type]}
    </span>
  );

  const renderStatsSection = () => {
    if (!stats || tableData.length === 0) return null;

    // Color breakdown pie chart (simple bars)
    const colorEntries = Object.entries(stats.colorBreakdown).sort((a, b) => b[1] - a[1]);
    const maxColorCount = Math.max(...colorEntries.map(e => e[1]), 1);

    // Rarity breakdown
    const rarityOrder = { 'Common': 0, 'Uncommon': 1, 'Rare': 2, 'Mythic': 3 };
    const rarityEntries = Object.entries(stats.rarityBreakdown)
      .sort((a, b) => (rarityOrder[a[0]] ?? 99) - (rarityOrder[b[0]] ?? 99));
    const maxRarityCount = Math.max(...rarityEntries.map(e => e[1]), 1);

    return (
      <Panel
        style={{
          marginBottom: 20,
          backgroundColor: '#2c2c2c',
          borderColor: '#444',
        }}
        bordered
        header={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>{hasSideboard ? 'Deck Statistics' : 'Collection Statistics'}</h4>
            <Button
              size="xs"
              appearance="subtle"
              onClick={() => setStatsExpanded(!statsExpanded)}
              style={{ padding: '4px 8px', transform: statsExpanded ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
            >
              <ArrowDown />
            </Button>
          </div>
        }
      >
        {statsExpanded && (
        <>
        {hasSideboard && sideboardCards > 0 && (
          <div style={{ fontSize: 13, marginBottom: 12, padding: '8px 12px', backgroundColor: '#333', borderRadius: 4 }}>
            Main Deck: <strong>{mainDeckCards}</strong> cards | Sideboard: <strong>{sideboardCards}</strong> cards
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 24, padding: '12px 0' }}>
          {/* Color Breakdown */}
          <div>
            <h5 style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>Colors</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {colorEntries.map(([color, count]) => {
                const barWidth = (count / maxColorCount) * 100;
                return (
                  <div key={color} style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>{color}</span>
                      <span>{count}</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        backgroundColor: '#444',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: '100%',
                          backgroundColor: '#3498db',
                          transition: 'width 0.2s',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rarity Breakdown */}
          <div>
            <h5 style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>Rarity</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rarityEntries.map(([rarity, count]) => {
                const barWidth = (count / maxRarityCount) * 100;
                return (
                  <div key={rarity} style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>{rarity}</span>
                      <span>{count}</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        backgroundColor: '#444',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: '100%',
                          backgroundColor: '#2ecc71',
                          transition: 'width 0.2s',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Stats */}
          <div>
            <h5 style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>Summary</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Cards:</span>
                <strong>{stats.totalCardCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Purchase Value:</span>
                <strong>${stats.totalPurchaseValue.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Top 10 Most Valuable */}
          {stats.top10MostValuableCards.length > 0 && (
            <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <h5 style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>Top 10 Most Valuable</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 250, overflowY: 'auto' }}>
                {stats.top10MostValuableCards.map((card) => (
                  <div
                    key={card.scryfall_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      paddingBottom: 4,
                      borderBottom: '1px solid #444',
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.name}
                      {card.quantity > 1 && <span style={{ color: COLORS.muted }}> x{card.quantity}</span>}
                    </span>
                    <span style={{ marginLeft: 8, whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                      ${card.totalValue.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </Panel>
    );
  };

  const validateDeck = async () => {
    setValidationLoading(true);
    setValidationOpen(true);
    
    try {
      const response = await authFetch(`/collections/${id}/validate`);
      if (!isMountedRef.current) return;
      
      if (!response.ok) {
        toaster.push(
          <Message type="error" showIcon closable>
            Failed to validate deck
          </Message>,
          { placement: 'topCenter' }
        );
        return;
      }
      
      const result = await response.json();
      if (isMountedRef.current) {
        setValidationResult(result);
      }
    } catch (err) {
      console.error('Validation error:', err);
      toaster.push(
        <Message type="error" showIcon closable>
          Error validating deck
        </Message>,
        { placement: 'topCenter' }
      );
    } finally {
      if (isMountedRef.current) {
        setValidationLoading(false);
      }
    }
  };

  // Clear validation when table data changes
  useEffect(() => {
    setValidationResult(null);
  }, [refreshKey]);

  if (loading) {
    return (
      <CustomProvider theme="dark">
        <NavigationBar />
        <Container>
          <Content>
            <Loader center size="md" content="Loading collection..." style={{ marginTop: 100 }} />
          </Content>
        </Container>
      </CustomProvider>
    );
  }

  if (error) {
    return (
      <CustomProvider theme="dark">
        <NavigationBar />
        <Container>
          <Content>
            <div style={{ maxWidth: SPACING.containerMaxWidth, margin: `${SPACING.containerMarginTop}px auto`, padding: `0 ${SPACING.containerPadding}px` }}>
              <Message type="error" showIcon>{error}</Message>
            </div>
          </Content>
        </Container>
      </CustomProvider>
    );
  }

  return (
    <CustomProvider theme="dark">
      <NavigationBar />
      <Container>
        <Content>
          <div style={{ maxWidth: SPACING.containerMaxWidth, margin: `${SPACING.containerMarginTop}px auto`, padding: `0 ${SPACING.containerPadding}px` }}>
            <div style={{ marginBottom: SPACING.headerMarginBottom }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{collection.name}</h3>
                {typeBadge(collection.type)}
                {collection.deck_type && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: COLORS.muted }}>
                    {collection.deck_type}
                  </span>
                )}
              </div>
              {collection.description && (
                <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 8 }}>
                  {collection.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: SPACING.statsGap, flexWrap: 'wrap', alignItems: 'center' }}>
               <Badge content={`${collection.pagination?.total || collection.entries?.length || 0} entries`} />
               {hasSideboard ? (
                 <>
                   <Badge content={`Main: ${mainDeckCards}`} />
                   <Badge content={`Sideboard: ${sideboardCards}`} />
                 </>
               ) : (
                 <Badge content={`${tableData.reduce((sum, e) => sum + (e.quantity || 0), 0)} total cards`} />
               )}
                {(priceLoading || cardLoading) && (
                  <span style={{ fontSize: 13, color: COLORS.muted }}>
                    {totalPages > 1 && currentPageNum > 0 ? (
                      <>Loading page {currentPageNum} of {totalPages}...</>
                    ) : (
                      <>Fetching prices...</>
                    )}
                  </span>
                )}
                {totalPages > 1 && paginationProgress > 0 && paginationProgress < 1 && (
                  <div style={{ width: 200, marginLeft: 8 }}>
                    <Progress.Line
                      percent={Math.round(paginationProgress * 100)}
                      status="active"
                    />
                  </div>
                )}
                {tableData.length > 0 && (
                  <Button
                    size="xs"
                    appearance="ghost"
                    onClick={() => setExportModalOpen(true)}
                  >
                    Export CSV
                  </Button>
                )}
                {collection.type === 'DECK' && tableData.length > 0 && (
                  <Button
                    size="xs"
                    appearance="primary"
                    onClick={validateDeck}
                    loading={validationLoading}
                  >
                    Validate Deck
                  </Button>
                )}
              </div>
              {tableData.length > 0 && !priceLoading && (
                <div style={{ display: 'flex', gap: SPACING.statsGap, flexWrap: 'wrap', marginTop: 8, fontSize: 13 }}>
                  <span>Purchase Value: <strong>${priceSummary.totalPurchase.toFixed(2)}</strong></span>
                  <span>Current Value: <strong>${priceSummary.totalCurrent.toFixed(2)}</strong></span>
                  {priceSummary.trackable.length > 0 && (
                    <span>Gain/Loss: <strong style={{ color: priceSummary.glColor }}>{priceSummary.glPrefix}${priceSummary.totalGainLoss.toFixed(2)}</strong></span>
                  )}
                </div>
              )}
            </div>

            {tableData.length > 0 && (
              <CollectionFilters
                nameSearch={nameSearch}
                setNameSearch={setNameSearch}
                colorFilter={colorFilter}
                setColorFilter={setColorFilter}
                rarityFilter={rarityFilter}
                setRarityFilter={setRarityFilter}
                conditionFilter={conditionFilter}
                setConditionFilter={setConditionFilter}
                onClearFilters={handleClearFilters}
                totalCount={tableData.length}
                filteredCount={sortedData.length}
              />
            )}

            {hasSideboard && (
              <div style={{ marginBottom: 16 }}>
                <ButtonGroup>
                  <Button
                    appearance={deckSection === 'all' ? 'primary' : 'default'}
                    size="sm"
                    onClick={() => setDeckSection('all')}
                  >
                    All
                  </Button>
                  <Button
                    appearance={deckSection === 'main' ? 'primary' : 'default'}
                    size="sm"
                    onClick={() => setDeckSection('main')}
                  >
                    Main Deck ({mainDeckCards})
                  </Button>
                  <Button
                    appearance={deckSection === 'side' ? 'primary' : 'default'}
                    size="sm"
                    onClick={() => setDeckSection('side')}
                  >
                    Sideboard ({sideboardCards})
                  </Button>
                </ButtonGroup>
              </div>
            )}

            {renderStatsSection()}

            {tableData.length === 0 && !cardLoading ? (
              <div style={{ textAlign: 'center', padding: `${SPACING.emptyPadding}px 0`, color: COLORS.muted }}>
                <p style={{ fontSize: 18, marginBottom: 8 }}>No cards in this collection</p>
                <p>Add cards from card pages to start building your collection.</p>
              </div>
            ) : (
               <Table
                 loading={cardLoading}
                 data={sortedData}
                 height={window.innerHeight - 250}
                 onRowClick={handleRowClick}
                 virtualized
                 rowHeight={46}
                 sortColumn={displaySortColumn}
                 sortType={sortType}
                 onSortColumn={handleSortColumn}
                 rowClassName={(rowData) => {
                   const { errorMap, warningMap } = validationHighlights;
                   const scryfallId = rowData?.scryfall_id;
                   if (scryfallId && errorMap[scryfallId]) {
                     return 'violation-error-row';
                   }
                   if (scryfallId && warningMap[scryfallId]) {
                     return 'violation-warning-row';
                   }
                   return '';
                 }}
               >
                 {columns.map(({ key, label, custom, sortKey, ...rest }) => (
                   <Column {...rest} key={key}>
                     <HeaderCell>{label}</HeaderCell>
                     {custom === 'actions'
                       ? <ActionsCell dataKey={key} />
                       : custom
                         ? <GainLossCell dataKey={key} />
                         : key === 'name'
                           ? <NameCell dataKey={key} errorMap={validationHighlights.errorMap} warningMap={validationHighlights.warningMap} />
                           : <Cell dataKey={key} />}
                   </Column>
                 ))}
               </Table>
            )}

            <EditEntryModal
              open={editModalOpen}
              onClose={handleEditClose}
              entry={editEntry}
              collectionId={id}
              onUpdated={handleEntryUpdated}
            />

            <Modal open={deleteModalOpen} onClose={handleDeleteClose} size="xs">
              <Modal.Header>
                <Modal.Title>Delete Entry</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                Are you sure you want to remove{' '}
                <strong>{deleteEntry?.name}</strong> from <strong>{collection?.name}</strong>?
              </Modal.Body>
              <Modal.Footer>
                <Button onClick={handleDeleteClose} appearance="subtle">
                  Cancel
                </Button>
                <Button onClick={handleDeleteConfirm} appearance="primary" color="red" loading={deleting}>
                  Delete
                </Button>
              </Modal.Footer>
            </Modal>

            <ExportCSVModal
              open={exportModalOpen}
              onClose={() => setExportModalOpen(false)}
              collectionName={collection?.name}
              entries={tableData}
            />

            <Modal open={validationOpen} onClose={() => setValidationOpen(false)} size="lg">
              <Modal.Header>
                <Modal.Title>
                  {collection?.deck_type} Deck Validation
                </Modal.Title>
              </Modal.Header>
              <Modal.Body style={{ maxHeight: '70vh', overflow: 'auto' }}>
                {validationLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                    <Loader center size="md" content="Validating deck..." />
                  </div>
                ) : validationResult ? (
                  <>
                    {validationResult.valid ? (
                      <Message
                        type="success"
                        showIcon
                        style={{ marginBottom: 16 }}
                      >
                        Deck is legal for {collection?.deck_type}!
                      </Message>
                    ) : null}

                    {validationResult.errors && validationResult.errors.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <h5 style={{ marginBottom: 8, color: '#e74c3c' }}>Errors</h5>
                        {validationResult.errors.map((error, idx) => (
                          <Panel key={idx} style={{ marginBottom: 8 }} shaded>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ color: '#e74c3c', fontSize: 18, flexShrink: 0 }}>✕</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                  {error.type}
                                </div>
                                <div style={{ marginBottom: 8, fontSize: 13 }}>
                                  {error.message}
                                </div>
                                {error.cards && error.cards.length > 0 && (
                                  <div style={{ fontSize: 12 }}>
                                    Cards: {error.cards.map((card, cardIdx) => (
                                      <span key={cardIdx}>
                                        <a
                                          href={`/cardsearch/${card.scryfall_id}`}
                                          style={{ color: '#3498db', textDecoration: 'none' }}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            navigate(`/cardsearch/${card.scryfall_id}`);
                                          }}
                                        >
                                          {card.name}
                                        </a>
                                        {cardIdx < error.cards.length - 1 ? ', ' : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Panel>
                        ))}
                      </div>
                    )}

                    {validationResult.warnings && validationResult.warnings.length > 0 && (
                      <div>
                        <h5 style={{ marginBottom: 8, color: '#f39c12' }}>Warnings</h5>
                        {validationResult.warnings.map((warning, idx) => (
                          <Panel key={idx} style={{ marginBottom: 8 }} shaded>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ color: '#f39c12', fontSize: 18, flexShrink: 0 }}>⚠</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                  {warning.type}
                                </div>
                                <div style={{ marginBottom: 8, fontSize: 13 }}>
                                  {warning.message}
                                </div>
                                {warning.cards && warning.cards.length > 0 && (
                                  <div style={{ fontSize: 12 }}>
                                    Cards: {warning.cards.map((card, cardIdx) => (
                                      <span key={cardIdx}>
                                        <a
                                          href={`/cardsearch/${card.scryfall_id}`}
                                          style={{ color: '#3498db', textDecoration: 'none' }}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            navigate(`/cardsearch/${card.scryfall_id}`);
                                          }}
                                        >
                                          {card.name}
                                        </a>
                                        {cardIdx < warning.cards.length - 1 ? ', ' : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Panel>
                        ))}
                      </div>
                    )}

                    {!validationResult.valid && (!validationResult.errors || validationResult.errors.length === 0) && (
                      <Message type="error" showIcon>
                        Deck validation failed
                      </Message>
                    )}
                  </>
                ) : null}
              </Modal.Body>
            </Modal>
          </div>
        </Content>
      </Container>
    </CustomProvider>
  );
};

export default CollectionDetail;
