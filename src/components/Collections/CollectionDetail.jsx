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
  Modal,
  useToaster,
} from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';
import EditEntryModal from './EditEntryModal';
import CollectionFilters from './CollectionFilters';
import ExportCSVModal from './ExportCSVModal';
import authFetch from '../../helpers/authFetch';

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
  const priceCacheRef = useRef({});
  const toaster = useToaster();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

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
      try {
        const response = await authFetch(`/collections/${id}?limit=100`);
        if (!isMountedRef.current) return;
        if (!response.ok) {
          if (response.status === 404) {
            setError('Collection not found');
          } else if (response.status === 403) {
            setError('You do not have access to this collection');
          } else {
            setError('Failed to load collection');
          }
          return;
        }
        const data = await response.json();
        if (!isMountedRef.current) return;
        setCollection(data);

        if (data.entries && data.entries.length > 0) {
          setCardLoading(true);
          setPriceLoading(true);

          const scryfallIds = data.entries.map((e) => e.scryfall_id);
          const cards = await fetchCardsBatch(scryfallIds);
          if (!isMountedRef.current) return;

          const enriched = data.entries.map((entry, idx) => {
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

          setTableData(enriched);
          setCardLoading(false);
          setPriceLoading(false);
        }
      } catch (err) {
        if (isMountedRef.current) setError('Unable to connect to server');
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    fetchCollection();
  }, [id, refreshKey]);

  const filteredData = useMemo(() => {
    let data = tableData;

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
  }, [tableData, nameSearch, colorFilter, rarityFilter, conditionFilter]);

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

  const handleClearFilters = () => {
    setNameSearch('');
    setColorFilter([]);
    setRarityFilter([]);
    setConditionFilter([]);
    setSortColumn(null);
    setSortType(null);
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
                <Badge content={`${collection.entries?.length || 0} entries`} />
                <Badge content={`${(collection.entries || []).reduce((sum, e) => sum + (e.quantity || 0), 0)} total cards`} />
                {priceLoading && <Loader size="xs" content="Fetching prices..." />}
                {tableData.length > 0 && (
                  <Button
                    size="xs"
                    appearance="ghost"
                    onClick={() => setExportModalOpen(true)}
                  >
                    Export CSV
                  </Button>
                )}
              </div>
              {tableData.length > 0 && !priceLoading && (() => {
                const withPurchase = tableData.filter((r) => r.purchase_price_raw != null);
                const totalPurchase = withPurchase.reduce((s, r) => s + r.purchase_price_raw * (r.quantity || 1), 0);
                const totalCurrent = tableData.reduce((s, r) => s + (r.current_price_raw || 0) * (r.quantity || 1), 0);
                const trackable = withPurchase.filter((r) => r.current_price_raw != null);
                const trackablePurchase = trackable.reduce((s, r) => s + r.purchase_price_raw * (r.quantity || 1), 0);
                const trackableCurrent = trackable.reduce((s, r) => s + r.current_price_raw * (r.quantity || 1), 0);
                const totalGainLoss = trackableCurrent - trackablePurchase;
                const glColor = totalGainLoss > 0 ? COLORS.gain : totalGainLoss < 0 ? COLORS.loss : COLORS.muted;
                const glPrefix = totalGainLoss > 0 ? '+' : '';
                return (
                  <div style={{ display: 'flex', gap: SPACING.statsGap, flexWrap: 'wrap', marginTop: 8, fontSize: 13 }}>
                    <span>Purchase Value: <strong>${totalPurchase.toFixed(2)}</strong></span>
                    <span>Current Value: <strong>${totalCurrent.toFixed(2)}</strong></span>
                    {trackable.length > 0 && (
                      <span>Gain/Loss: <strong style={{ color: glColor }}>{glPrefix}${totalGainLoss.toFixed(2)}</strong></span>
                    )}
                  </div>
                );
              })()}
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
              >
                {columns.map(({ key, label, custom, ...rest }) => (
                  <Column {...rest} key={key}>
                    <HeaderCell>{label}</HeaderCell>
                    {custom === 'actions'
                      ? <ActionsCell dataKey={key} />
                      : custom
                        ? <GainLossCell dataKey={key} />
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
          </div>
        </Content>
      </Container>
    </CustomProvider>
  );
};

export default CollectionDetail;
