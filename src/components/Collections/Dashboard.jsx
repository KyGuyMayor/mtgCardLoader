import React, { useEffect, useState } from 'react';
import {
  Container,
  Content,
  CustomProvider,
  Panel,
  Button,
  Badge,
  Message,
  Modal,
  FlexboxGrid,
  Loader,
} from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';

import NavigationBar from '../Shared/NavigationBar';
import authFetch from '../../helpers/authFetch';

const BADGE_COLORS = {
  DECK: '#3498db',
  TRADE_BINDER: '#2ecc71',
};

const BADGE_LABELS = {
  DECK: 'Deck',
  TRADE_BINDER: 'Trade Binder',
};

const SPACING = {
  containerMaxWidth: 900,
  containerPadding: 16,
  containerMarginTop: 30,
  headerMarginBottom: 24,
  cardMarginBottom: 12,
  cardPadding: 16,
  errorMarginBottom: 16,
  emptyPadding: 60,
  descriptionMarginTop: 8,
  actionsGap: 12,
  badgeMarginLeft: 8,
};

const FONT = {
  collectionName: 16,
  badgeLabel: 12,
  deckType: 12,
  emptyTitle: 18,
  description: 13,
};

const COLORS = {
  muted: '#aaa',
};

const Dashboard = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();

  const fetchCollections = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/collections');

      if (!response.ok) {
        setError('Failed to load collections');
        return;
      }

      const data = await response.json();
      setCollections(data);
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await authFetch(`/collections/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (response.ok || response.status === 204) {
        setCollections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      } else {
        setError('Failed to delete collection');
      }
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const typeBadge = (type) => (
    <span
      style={{
        backgroundColor: BADGE_COLORS[type],
        color: '#fff',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: FONT.badgeLabel,
        marginLeft: SPACING.badgeMarginLeft,
      }}
    >
      {BADGE_LABELS[type]}
    </span>
  );

  const styles = {
    container: {
      maxWidth: SPACING.containerMaxWidth,
      margin: `${SPACING.containerMarginTop}px auto`,
      padding: `0 ${SPACING.containerPadding}px`,
    },
    header: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'stretch' : 'center',
      gap: isMobile ? SPACING.cardMarginBottom : 0,
      marginBottom: SPACING.headerMarginBottom,
    },
    card: { cursor: 'pointer', marginBottom: SPACING.cardMarginBottom },
    cardHeader: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: isMobile ? SPACING.cardMarginBottom : 0,
    },
    cardTitle: { display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
    actions: {
      display: 'flex',
      alignItems: 'center',
      gap: SPACING.actionsGap,
    },
    empty: {
      textAlign: 'center',
      padding: `${SPACING.emptyPadding}px 0`,
      color: COLORS.muted,
    },
  };

  return (
    <CustomProvider theme="dark">
      <NavigationBar />
      <Container>
        <Content>
          <div style={styles.container}>
            <div style={styles.header}>
              <h3>My Collections</h3>
              <Button
                appearance="primary"
                block={isMobile}
                onClick={() => navigate('/collections/new')}
              >
                Create New Collection
              </Button>
            </div>

            {error && (
              <Message type="error" showIcon style={{ marginBottom: SPACING.errorMarginBottom }}>
                {error}
              </Message>
            )}

            {loading ? (
              <Loader center size="md" content="Loading collections..." />
            ) : collections.length === 0 ? (
              <div style={styles.empty}>
                <p style={{ fontSize: FONT.emptyTitle, marginBottom: SPACING.badgeMarginLeft }}>
                  No collections yet
                </p>
                <p>Create your first collection to start tracking your cards.</p>
              </div>
            ) : (
              <FlexboxGrid>
                {collections.map((collection) => (
                  <FlexboxGrid.Item colspan={24} key={collection.id} style={styles.card}>
                    <Panel
                      bordered
                      bodyFill
                      onClick={() => navigate(`/collections/${collection.id}`)}
                      style={{ padding: SPACING.cardPadding }}
                    >
                      <div style={styles.cardHeader}>
                        <div style={styles.cardTitle}>
                          <span style={{ fontSize: FONT.collectionName, fontWeight: 600 }}>
                            {collection.name}
                          </span>
                          {typeBadge(collection.type)}
                          {collection.deck_type && (
                            <span
                              style={{
                                marginLeft: SPACING.badgeMarginLeft,
                                fontSize: FONT.deckType,
                                color: COLORS.muted,
                              }}
                            >
                              {collection.deck_type}
                            </span>
                          )}
                        </div>
                        <div style={styles.actions}>
                          <Badge content={`${collection.card_count} cards`} />
                          <Button
                            size="xs"
                            color="red"
                            appearance="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(collection);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      {collection.description && (
                        <p
                          style={{
                            marginTop: SPACING.descriptionMarginTop,
                            color: COLORS.muted,
                            fontSize: FONT.description,
                          }}
                        >
                          {collection.description}
                        </p>
                      )}
                    </Panel>
                  </FlexboxGrid.Item>
                ))}
              </FlexboxGrid>
            )}
          </div>

          <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} size="xs">
            <Modal.Header>
              <Modal.Title>Delete Collection</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will
              remove all cards in the collection and cannot be undone.
            </Modal.Body>
            <Modal.Footer>
              <Button onClick={() => setDeleteTarget(null)} appearance="subtle">
                Cancel
              </Button>
              <Button onClick={handleDelete} appearance="primary" color="red" loading={deleting}>
                Delete
              </Button>
            </Modal.Footer>
          </Modal>
        </Content>
      </Container>
    </CustomProvider>
  );
};

export default Dashboard;
