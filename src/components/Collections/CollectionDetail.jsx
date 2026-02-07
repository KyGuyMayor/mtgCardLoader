import React, { useEffect, useState, useRef } from 'react';
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
} from 'rsuite';

import NavigationBar from '../Shared/NavigationBar';
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

const defaultColumns = [
  { key: 'name', label: 'Name', fixed: true, flexGrow: 2 },
  { key: 'type_line', label: 'Type', flexGrow: 1 },
];

const desktopColumns = [
  { key: 'rarity', label: 'Rarity', flexGrow: 1 },
  { key: 'colors', label: 'Colors', flexGrow: 1 },
  { key: 'set_name', label: 'Set', flexGrow: 1 },
  { key: 'purchase_price_display', label: 'Purchase Price', flexGrow: 1 },
  { key: 'current_price', label: 'Current Price', flexGrow: 1 },
  { key: 'gain_loss', label: 'Gain/Loss', flexGrow: 1, custom: true },
  { key: 'condition', label: 'Condition', flexGrow: 1 },
];

const quantityColumn = { key: 'quantity', label: 'Quantity', width: 90 };

const CollectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState('');
  const priceCacheRef = useRef({});
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
            return {
              ...entry,
              name: card?.name || 'Unknown Card',
              type_line: card?.type_line || '',
              rarity: card?.rarity || '',
              colors: (card?.colors || []).join(', ') || 'Colorless',
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
  }, [id]);

  const handleRowClick = (rowData) => {
    if (rowData.scryfall_id) {
      navigate(`/cardsearch/${rowData.scryfall_id}`);
    }
  };

  const columns = isMobile
    ? [...defaultColumns, quantityColumn]
    : [...defaultColumns, ...desktopColumns, quantityColumn];

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

            {tableData.length === 0 && !cardLoading ? (
              <div style={{ textAlign: 'center', padding: `${SPACING.emptyPadding}px 0`, color: COLORS.muted }}>
                <p style={{ fontSize: 18, marginBottom: 8 }}>No cards in this collection</p>
                <p>Add cards from card pages to start building your collection.</p>
              </div>
            ) : (
              <Table
                loading={cardLoading}
                data={tableData}
                height={window.innerHeight - 250}
                onRowClick={handleRowClick}
                virtualized
                rowHeight={46}
              >
                {columns.map(({ key, label, custom, ...rest }) => (
                  <Column {...rest} key={key}>
                    <HeaderCell>{label}</HeaderCell>
                    {custom ? <GainLossCell dataKey={key} /> : <Cell dataKey={key} />}
                  </Column>
                ))}
              </Table>
            )}
          </div>
        </Content>
      </Container>
    </CustomProvider>
  );
};

export default CollectionDetail;
