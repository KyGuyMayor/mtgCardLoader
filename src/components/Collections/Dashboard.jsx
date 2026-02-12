import React, { useEffect, useState, useRef } from 'react';
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
  Tooltip,
  Whisper,
} from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';

import NavigationBar from '../Shared/NavigationBar';
import CreateCollectionModal from './CreateCollectionModal';
import ImportCSVModal from './ImportCSVModal';
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

const STATUS_COLORS = {
  pending: '#6c757d',
  valid: '#28a745',
  invalid: '#dc3545',
};

const Dashboard = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [validationCache, setValidationCache] = useState({});
  const validatingRef = useRef(new Set());
  const isMountedRef = useRef(true);

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

  // Validate DECK collections sequentially when collections load or change
  useEffect(() => {
    if (collections.length === 0) return;
  
    const validateDecks = async () => {
      for (const collection of collections) {
        // Only validate DECK type, not TRADE_BINDER or OTHER format
        if (collection.type !== 'DECK' || collection.deck_type === 'OTHER') {
          continue;
        }
  
        // Skip if already validating or already cached
        if (validatingRef.current.has(collection.id) || validationCache[collection.id]) {
          continue;
        }
  
        // Mark as validating
        validatingRef.current.add(collection.id);
  
        try {
          const response = await authFetch(`/collections/${collection.id}/validate`);
          if (response.ok) {
            const data = await response.json();
            if (isMountedRef.current) {
              setValidationCache(prev => ({
                ...prev,
                [collection.id]: data,
              }));
            }
          } else {
            // Set error state for failed validation (server error, not network failure)
            if (isMountedRef.current) {
              setValidationCache(prev => ({
                ...prev,
                [collection.id]: { valid: false, errors: [], warnings: [] },
              }));
            }
          }
        } catch (err) {
          console.error(`Failed to validate collection ${collection.id}:`, err);
          // Set distinct error state on network failure
          if (isMountedRef.current) {
            setValidationCache(prev => ({
              ...prev,
              [collection.id]: { error: true },
            }));
          }
        } finally {
          validatingRef.current.delete(collection.id);
        }
  
        // Small delay between sequential validations to avoid overwhelming the server
        await new Promise(r => setTimeout(r, 100));
      }
    };
  
    validateDecks();
  
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections]);

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

  const legalityBadge = (collection) => {
    // Only show badge for DECK type, not OTHER format
    if (collection.type !== 'DECK' || collection.deck_type === 'OTHER') {
      return null;
    }
  
    const validation = validationCache[collection.id];
  
    // Not yet validated (pending)
    if (!validation) {
      return (
        <Whisper
          placement="top"
          trigger="hover"
          speaker={<Tooltip>Checking deck validity...</Tooltip>}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS.pending,
              color: '#fff',
              fontSize: 12,
              fontWeight: 'bold',
              marginLeft: SPACING.badgeMarginLeft,
            }}
          >
            ?
          </span>
        </Whisper>
      );
    }
  
    // Validation error (network failure or server error)
    if (validation.error) {
      return (
        <Whisper
          placement="top"
          trigger="hover"
          speaker={<Tooltip>Unable to validate deck</Tooltip>}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS.pending,
              color: '#fff',
              fontSize: 12,
              fontWeight: 'bold',
              marginLeft: SPACING.badgeMarginLeft,
            }}
          >
            ?
          </span>
        </Whisper>
      );
    }
  
    // Empty deck check
    if (collection.card_count === 0) {
      return (
        <Whisper
          placement="top"
          trigger="hover"
          speaker={<Tooltip>Collection is empty</Tooltip>}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS.pending,
              color: '#fff',
              fontSize: 12,
              fontWeight: 'bold',
              marginLeft: SPACING.badgeMarginLeft,
            }}
          >
            ?
          </span>
        </Whisper>
      );
    }
  
    // Valid deck
    if (validation.valid) {
      return (
        <Whisper
          placement="top"
          trigger="hover"
          speaker={<Tooltip>Legal</Tooltip>}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS.valid,
              color: '#fff',
              fontSize: 14,
              fontWeight: 'bold',
              marginLeft: SPACING.badgeMarginLeft,
            }}
          >
            ✓
          </span>
        </Whisper>
      );
    }
  
    // Invalid deck (has errors)
    const totalIssues = (validation.errors?.length || 0) + (validation.warnings?.length || 0);
    const tooltipText = totalIssues === 1 ? '1 issue found' : `${totalIssues} issues found`;
  
    return (
      <Whisper
        placement="top"
        trigger="hover"
        speaker={<Tooltip>{tooltipText}</Tooltip>}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: STATUS_COLORS.invalid,
            color: '#fff',
            fontSize: 14,
            fontWeight: 'bold',
            marginLeft: SPACING.badgeMarginLeft,
          }}
        >
          ✕
        </span>
      </Whisper>
    );
  };

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
              <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                <Button
                  appearance="primary"
                  block={isMobile}
                  onClick={() => setShowCreateModal(true)}
                >
                  Create New Collection
                </Button>
                <Button
                  appearance="ghost"
                  block={isMobile}
                  onClick={() => setShowImportModal(true)}
                >
                  Import CSV
                </Button>
              </div>
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
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: SPACING.badgeMarginLeft,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: FONT.deckType,
                                  color: COLORS.muted,
                                }}
                              >
                                {collection.deck_type}
                              </span>
                              {legalityBadge(collection)}
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

          <CreateCollectionModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreated={fetchCollections}
          />

          <ImportCSVModal
            open={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImported={(data) => {
              navigate(`/collections/${data.collectionId}`);
            }}
          />

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
