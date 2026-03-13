import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import {
  CustomProvider,
  Container,
  Content,
  Table,
  Loader,
  Message,
  Panel,
  Input,
} from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';
import authFetch from '../../helpers/authFetch';
import useDebouncedSearch from '../../helpers/useDebouncedSearch';
import { RARITY_ORDER } from './CardAttributeDefaults';
import './CollectionDetail.css';

const { Column, HeaderCell, Cell } = Table;

const SPACING = {
  containerMaxWidth: 1100,
  containerPadding: 16,
  containerMarginTop: 30,
  headerMarginBottom: 20,
  statsGap: 16,
};

const COLORS = {
  muted: '#aaa',
  gain: '#2ecc71',
  loss: '#e74c3c',
};

const defaultColumns = [
  { key: 'name', label: 'Name', flexGrow: 2, sortable: true },
  { key: 'total_quantity', label: 'Total Qty', width: 100, sortable: true },
];

const desktopColumns = [
  { key: 'type_line', label: 'Type', flexGrow: 1, sortable: true },
  { key: 'rarity', label: 'Rarity', flexGrow: 1, sortable: true },
  { key: 'colors', label: 'Colors', flexGrow: 1 },
  { key: 'real_quantity', label: 'Real Qty', width: 90, sortable: true },
  { key: 'proxy_quantity', label: 'Proxy Qty', width: 90, sortable: true },
  { key: 'collections_count', label: 'Collections', width: 110, sortable: true },
  { key: 'current_price', label: 'Current Price', flexGrow: 1, sortable: true },
];

const GrandCollection = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [tableData, setTableData] = useState([]);
  const [allLoaded, setAllLoaded] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 0 });
  const [paginationProgress, setPaginationProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [nameSearch, setNameSearch] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortType, setSortType] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const priceCacheRef = useRef({});
  const isMountedRef = useRef(true);

  const [searchInput, setSearchInput] = useDebouncedSearch(nameSearch, useCallback((val) => setNameSearch(val), []));

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const enrichEntries = (entries, cards) => entries.map((entry, idx) => {
    const card = cards[idx];
    const finish = entry.finish || 'nonfoil';

    let usdPrice;
    if (card?.prices) {
      if (finish === 'foil') {
        usdPrice = card.prices.usd_foil || card.prices.usd || null;
      } else if (finish === 'etched') {
        usdPrice = card.prices.usd_etched || card.prices.usd || null;
      } else {
        usdPrice = card.prices.usd || null;
      }
    }

    const currentRaw = usdPrice ? Number(usdPrice) : null;
    const rawColors = card?.colors || [];
    const locationsCount = entry.locations?.length || 0;

    const realQty = entry.total_real_quantity || 0;
    const proxyQty = entry.total_proxy_quantity || 0;

    return {
      ...entry,
      scryfall_id: entry.scryfall_id,
      name: card?.name || 'Unknown Card',
      type_line: card?.type_line || '',
      rarity: card?.rarity || '',
      colors_raw: rawColors,
      colors: rawColors.join(', ') || 'Colorless',
      cmc: card?.cmc ?? 0,
      current_price: currentRaw != null ? `$${currentRaw.toFixed(2)}` : '',
      current_price_raw: currentRaw,
      real_quantity: realQty,
      proxy_quantity: proxyQty,
      collections_count: locationsCount,
      card_object: card,
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

  const fetchPage = async (pageNum) => {
    try {
      const url = `/collections/grand?page=${pageNum}&limit=100`;
      const res = await authFetch(url);

      if (!res.ok) {
        throw new Error('Failed to fetch grand collection');
      }

      const data = await res.json();

      if (!isMountedRef.current) return null;

      let enriched = [];
      if (data.cards && data.cards.length > 0) {
        const scryfallIds = data.cards.map(c => c.scryfall_id);
        const cards = await fetchCardsBatch(scryfallIds);

        if (!isMountedRef.current) return null;

        enriched = enrichEntries(data.cards, cards);
      }

      return { enriched, pagination: data.pagination };
    } catch (err) {
      throw err;
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setLoadingMore(false);
    setAllLoaded(false);
    setError('');

    try {
      const firstResult = await fetchPage(1);
      if (!firstResult || !isMountedRef.current) return;

      setTableData(firstResult.enriched);
      setPagination(firstResult.pagination);
      const pages = firstResult.pagination?.totalPages || 0;
      setTotalPages(pages);
      setPaginationProgress(1);
      setLoading(false);

      if (pages > 1) {
        setLoadingMore(true);
        for (let page = 2; page <= pages; page++) {
          if (!isMountedRef.current) break;
          setPaginationProgress(page);
          const result = await fetchPage(page);
          if (!result || !isMountedRef.current) break;
          setTableData(prev => [...prev, ...result.enriched]);
        }
        setLoadingMore(false);
      }

      setAllLoaded(true);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load grand collection');
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filteredData = useMemo(() => {
    if (!nameSearch) return tableData;
    const term = nameSearch.toLowerCase();
    return tableData.filter(card => card.name.toLowerCase().includes(term));
  }, [tableData, nameSearch]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortType) {
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      if (sortColumn === 'rarity') {
        aVal = RARITY_ORDER[aVal] ?? 99;
        bVal = RARITY_ORDER[bVal] ?? 99;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortType === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortType === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortType]);

  const handleSortColumn = (sortColumn, sortType) => {
    setSortColumn(sortColumn);
    setSortType(sortType);
  };

  const handleRowClick = (rowData) => {
    navigate(`/cardsearch/${rowData.scryfall_id}`);
  };

  const getColumns = () => {
    const cols = [...defaultColumns];
    if (!isMobile) {
      cols.push(...desktopColumns);
    }
    return cols;
  };

  const columns = getColumns();

  const summaryStats = useMemo(() => {
    const totalUnique = tableData.length;
    const totalReal = tableData.reduce((sum, card) => sum + (card.real_quantity || 0), 0);
    const totalProxy = tableData.reduce((sum, card) => sum + (card.proxy_quantity || 0), 0);
    const totalValue = tableData.reduce((sum, card) => {
      const qty = card.total_quantity || 0;
      const price = card.current_price_raw || 0;
      return sum + (qty * price);
    }, 0);
    return { totalUnique, totalReal, totalProxy, totalValue };
  }, [tableData]);

  const NameCell = ({ rowData, ...props }) => (
    <Cell {...props}>
      <span
        style={{ cursor: 'pointer', color: '#3498db' }}
        onClick={() => handleRowClick(rowData)}
      >
        {rowData.name}
      </span>
    </Cell>
  );

  const PriceCell = ({ rowData, ...props }) => (
    <Cell {...props}>
      {rowData.current_price || '-'}
    </Cell>
  );

  return (
    <CustomProvider theme="dark">
      <div style={{ backgroundColor: '#282c34', minHeight: '100vh' }}>
        <NavigationBar />
        <Container style={{ maxWidth: SPACING.containerMaxWidth, margin: '0 auto', padding: SPACING.containerPadding, marginTop: SPACING.containerMarginTop }}>
          <Content>
            <div style={{ marginBottom: SPACING.headerMarginBottom }}>
              <h2 style={{ margin: 0, color: '#fff' }}>Grand Collection</h2>
              <p style={{ margin: '8px 0 0', color: COLORS.muted }}>
                All unique cards across all your collections
              </p>
            </div>

            {summaryStats.totalUnique > 0 && (
              <Panel style={{ marginBottom: SPACING.containerPadding, backgroundColor: '#333' }}>
                <div style={{ display: 'flex', gap: SPACING.statsGap, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>Unique Cards</div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>
                      {summaryStats.totalUnique}{!allLoaded && '+'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>Real Copies</div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.gain }}>
                      {summaryStats.totalReal}{!allLoaded && '+'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>Proxy Copies</div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f39c12' }}>
                      {summaryStats.totalProxy}{!allLoaded && '+'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>Est. Value</div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>
                      ${summaryStats.totalValue.toFixed(2)}{!allLoaded && '+'}
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            {error && (
              <Message type="error" style={{ marginBottom: 16 }}>
                {error}
              </Message>
            )}

            <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Input
                placeholder="Search by name..."
                value={searchInput}
                onChange={setSearchInput}
                style={{ width: 250 }}
              />
              {loadingMore && (
                <span style={{ color: COLORS.muted }}>
                  Loading page {paginationProgress} of {totalPages}...
                </span>
              )}
            </div>

            {loading && tableData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Loader size="lg" />
              </div>
            ) : tableData.length === 0 ? (
              <Panel>
                <Message type="info">
                  You don't have any cards in your collections yet.
                </Message>
              </Panel>
            ) : (
              <Table
                data={sortedData}
                height={600}
                onSortColumn={handleSortColumn}
                sortColumn={sortColumn}
                sortType={sortType}
                onRowClick={handleRowClick}
                rowKey="scryfall_id"
                style={{ backgroundColor: '#222' }}
              >
                {columns.map((col) => (
                  <Column
                    key={col.key}
                    flexGrow={col.flexGrow}
                    width={col.width}
                    sortable={col.sortable}
                  >
                    <HeaderCell>{col.label}</HeaderCell>
                    {col.key === 'name' ? (
                      <NameCell />
                    ) : col.key === 'current_price' ? (
                      <PriceCell />
                    ) : (
                      <Cell dataKey={col.key} />
                    )}
                  </Column>
                ))}
              </Table>
            )}
          </Content>
        </Container>
      </div>
    </CustomProvider>
  );
};

export default GrandCollection;
