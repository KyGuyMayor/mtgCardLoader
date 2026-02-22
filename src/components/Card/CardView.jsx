import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import {
   CustomProvider,
   Container,
   Content,
   FlexboxGrid,
   Panel,
   Button,
   Badge,
   Loader,
   Divider,
   Tooltip,
   Whisper
 } from 'rsuite';

import CardStat from './CardStat';
import Link from '../Shared/Link';
import NavigationBar from '../Shared/NavigationBar';
import AddToCollectionModal from '../Collections/AddToCollectionModal';
import { useAuth } from '../Auth/AuthContext';

/**
 * Check if a card is double-faced (transform, modal DFC, etc.)
 * Double-faced cards have card_faces array but no top-level image_uris
 */
const isDoubleFaced = (card) => card?.card_faces && !card?.image_uris;

/**
 * Get the image URI for a card, handling double-faced cards
 * @param {object} card - The card object from Scryfall
 * @param {number} faceIndex - Which face to get (0 = front, 1 = back)
 * @returns {string|null} The image URI or null
 */
const getImageUri = (card, faceIndex = 0) => {
  if (card?.image_uris?.normal) {
    return card.image_uris.normal;
  }
  if (card?.card_faces?.[faceIndex]?.image_uris?.normal) {
    return card.card_faces[faceIndex].image_uris.normal;
  }
  return null;
};

/**
 * Get oracle text for a card, handling double-faced cards
 * For double-faced cards, returns formatted text with face names as labels
 * @param {object} card - The card object from Scryfall
 * @returns {string|null} The oracle text or null
 */
const getOracleText = (card) => {
  if (card?.oracle_text) {
    return card.oracle_text;
  }
  if (card?.card_faces) {
    return card.card_faces
      .map(face => `${face.name}:\n${face.oracle_text || ''}`)
      .join('\n\n');
  }
  return null;
};

/**
 * Get the current face data for a card
 * For double-faced cards, returns the face at the given index
 * For normal cards, returns the card itself
 */
const getCurrentFace = (card, faceIndex = 0) => {
  if (isDoubleFaced(card)) {
    return card.card_faces[faceIndex];
  }
  return card;
};

/**
 * Get power for a card, handling double-faced cards
 */
const getPower = (card, faceIndex = 0) => {
  const face = getCurrentFace(card, faceIndex);
  return face?.power || null;
};

/**
 * Get toughness for a card, handling double-faced cards
 */
const getToughness = (card, faceIndex = 0) => {
  const face = getCurrentFace(card, faceIndex);
  return face?.toughness || null;
};

/**
 * Get loyalty for a card, handling double-faced cards
 */
const getLoyalty = (card, faceIndex = 0) => {
  const face = getCurrentFace(card, faceIndex);
  return face?.loyalty || null;
};

const RULINGS_PANEL_MARGIN_TOP = 20;
const RULINGS_HEADER_GAP = 8;
const RULINGS_META_FONT_SIZE = 12;
const RULINGS_ITEM_MARGIN_BOTTOM = 4;
const RULINGS_DIVIDER_MARGIN = '8px 0';

const PRINTINGS_THUMBNAIL_HEIGHT = 60;
const PRINTINGS_THUMBNAIL_BORDER_RADIUS = 2;
const PRINTINGS_LIST_GAP = 8;
const PRINTINGS_LIST_OVERFLOW_PADDING = 8;
const PRINTINGS_BORDER_WIDTH = 2;
const PRINTINGS_HIGHLIGHT_OPACITY = 1;
const PRINTINGS_DIM_OPACITY = 0.6;
const PRINTINGS_HIGHLIGHT_COLOR = '#00d9ff';
const PRINTINGS_HOVER_TRANSITION = 'opacity 0.2s';

const CardView = () => {
   const {id} = useParams();
   const navigate = useNavigate();
   const [card, setCard] =  useState();
   const [activeFace, setActiveFace] = useState(0);
   const [showAddModal, setShowAddModal] = useState(false);
   const [rulings, setRulings] = useState([]);
   const [rulingsLoading, setRulingsLoading] = useState(false);
   const [rulingsError, setRulingsError] = useState(false);
   const [printings, setPrintings] = useState([]);
   const [printingsLoading, setPrintingsLoading] = useState(false);
   const [printingsError, setPrintingsError] = useState(false);
   const { isAuthenticated } = useAuth();

  const toggleFace = () => {
    setActiveFace(prev => prev === 0 ? 1 : 0);
  };

  useEffect(() => {
    const fetchData = async () => {
      const cardData  = await fetch(`/cards/${id}`);
      const cardJSON = await cardData.json();
      setCard(cardJSON);
    } 
       
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!card?.id) return;
    const fetchRulings = async () => {
      setRulingsLoading(true);
      setRulingsError(false);
      try {
        const res = await fetch(`/cards/${card.id}/rulings`);
        if (!res.ok) throw new Error('Failed to fetch rulings');
        const data = await res.json();
        const sorted = [...data].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        setRulings(sorted);
      } catch {
        setRulingsError(true);
      } finally {
        setRulingsLoading(false);
      }
    };
    fetchRulings();
  }, [card?.id]);

  useEffect(() => {
    if (!card?.id) return;
    const fetchPrintings = async () => {
      setPrintingsLoading(true);
      setPrintingsError(false);
      try {
        const res = await fetch(`/cards/${card.id}/printings`);
        if (!res.ok) throw new Error('Failed to fetch printings');
        const data = await res.json();
        setPrintings(data);
      } catch {
        setPrintingsError(true);
      } finally {
        setPrintingsLoading(false);
      }
    };
    fetchPrintings();
  }, [card?.id]);

  useEffect(() => {
    if (isDoubleFaced(card)) {
      const otherFace = activeFace === 0 ? 1 : 0;
      const otherUri = getImageUri(card, otherFace);
      if (otherUri) {
        const img = new Image();
        img.src = otherUri;
      }
    }
  }, [card, activeFace]);

  return (
    <CustomProvider theme="dark">
      <Container>
        <NavigationBar />
          <Content style={{ marginTop: "15px" }}>
            <FlexboxGrid justify="center" align="top">
              <FlexboxGrid.Item colspan={isMobile ? 20 : 14} style={{ paddingRight: isMobile ? "0px" : "10px" }}>
                <Panel bordered>
                  <h2 style={{ marginBottom: "25px"}}>{card?.name}</h2>
                  {getPower(card, activeFace) && 
                    <>
                      <CardStat title="Power" value={getPower(card, activeFace)} />
                      <CardStat title="Toughness" value={getToughness(card, activeFace)} />
                    </>
                  }
                  {getLoyalty(card, activeFace) &&
                    <CardStat title="Loyalty" value={getLoyalty(card, activeFace)} />
                  }
                  <CardStat title="Approximate Cost" value={"$" + card?.prices?.usd} />
                  {card?.prices.usd_foil &&
                    <CardStat title="Approximate Foil Cost" value={"$" + card?.prices?.usd_foil} />
                  }
                  <CardStat title="Set" value={card?.set_name} />
                  <CardStat title="Commander Legality" value={card?.legalities?.commander === "legal" ? "Legal" : "Not Legal"} />
                  <CardStat title="Standard Legality" value={card?.legalities?.standard === "legal" ? "Legal" : "Not Legal"} />
                  <CardStat title="Ability" value={getOracleText(card)} />
                  <h5 style={{marginTop: "25px"}}>Purchase Links</h5>
                  <Link url={card?.purchase_uris?.tcgplayer} title="TCG Player" />
                  <Link url={card?.purchase_uris?.cardmarket} title="Card Market" />
                  <Panel
                    collapsible
                    defaultExpanded
                    bordered
                    header={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: RULINGS_HEADER_GAP }}>
                        Rulings
                        {rulings.length > 0 && <Badge content={rulings.length} />}
                      </span>
                    }
                    style={{ marginTop: RULINGS_PANEL_MARGIN_TOP }}
                  >
                    {rulingsLoading && <Loader content="Loading rulings..." />}
                    {rulingsError && <p style={{ color: '#aaa' }}>Unable to load rulings.</p>}
                    {!rulingsLoading && !rulingsError && rulings.length === 0 && (
                      <p style={{ color: '#aaa' }}>No rulings available for this card.</p>
                    )}
                    {!rulingsLoading && !rulingsError && rulings.map((ruling, i) => (
                      <div key={i}>
                        <p style={{ whiteSpace: 'pre-wrap', marginBottom: RULINGS_ITEM_MARGIN_BOTTOM }}>{ruling.comment}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: RULINGS_META_FONT_SIZE, color: '#888', marginBottom: RULINGS_ITEM_MARGIN_BOTTOM }}>
                          <span>{new Date(ruling.published_at + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          <span>{ruling.source === 'wotc' ? 'WotC' : 'Scryfall'}</span>
                        </div>
                        {i < rulings.length - 1 && <Divider style={{ margin: RULINGS_DIVIDER_MARGIN }} />}
                      </div>
                    ))}
                  </Panel>

                  {printings.length > 1 && (
                    <Panel
                      collapsible
                      defaultExpanded
                      bordered
                      header={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: RULINGS_HEADER_GAP }}>
                          Other Printings
                          {printings.length > 1 && <Badge content={printings.length - 1} />}
                        </span>
                      }
                      style={{ marginTop: RULINGS_PANEL_MARGIN_TOP }}
                    >
                      {printingsLoading && <Loader content="Loading printings..." />}
                      {printingsError && <p style={{ color: '#aaa' }}>Unable to load printings.</p>}
                      {!printingsLoading && !printingsError && (
                        <div
                          style={{
                            display: 'flex',
                            gap: `${PRINTINGS_LIST_GAP}px`,
                            overflowX: 'auto',
                            paddingBottom: `${PRINTINGS_LIST_OVERFLOW_PADDING}px`,
                          }}
                        >
                          {printings.map((printing) => (
                            <Whisper
                              key={printing.id}
                              placement="top"
                              trigger="hover"
                              speaker={
                                <Tooltip>
                                  {printing.set_name} #{printing.collector_number}
                                </Tooltip>
                              }
                            >
                              <div
                                onClick={() => navigate(`/cardsearch/${printing.id}`)}
                                style={{
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  opacity: printing.id === card?.id ? PRINTINGS_HIGHLIGHT_OPACITY : PRINTINGS_DIM_OPACITY,
                                  border: printing.id === card?.id ? `${PRINTINGS_BORDER_WIDTH}px solid ${PRINTINGS_HIGHLIGHT_COLOR}` : `${PRINTINGS_BORDER_WIDTH}px solid transparent`,
                                  borderRadius: `${PRINTINGS_THUMBNAIL_BORDER_RADIUS}px`,
                                  transition: PRINTINGS_HOVER_TRANSITION,
                                }}
                                onMouseEnter={(e) => {
                                  if (printing.id !== card?.id) {
                                    e.currentTarget.style.opacity = '0.9';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (printing.id !== card?.id) {
                                    e.currentTarget.style.opacity = String(PRINTINGS_DIM_OPACITY);
                                  }
                                }}
                              >
                                {printing.image_uris && (
                                  <img
                                    src={printing.image_uris.small}
                                    alt={printing.name}
                                    style={{
                                      height: `${PRINTINGS_THUMBNAIL_HEIGHT}px`,
                                      borderRadius: `${PRINTINGS_THUMBNAIL_BORDER_RADIUS}px`,
                                    }}
                                  />
                                )}
                              </div>
                            </Whisper>
                          ))}
                        </div>
                      )}
                    </Panel>
                  )}

                  {isAuthenticated && (
                    <Button
                      appearance="primary"
                      color="green"
                      block
                      style={{ marginTop: 20 }}
                      onClick={() => setShowAddModal(true)}
                    >
                      Add to Collection
                    </Button>
                  )}
                </Panel>
              </FlexboxGrid.Item>
              
            {!isMobile &&
              <FlexboxGrid.Item colspan={4}>
                <img
                  src={getImageUri(card, activeFace)}
                  alt={card?.name || 'Card image'}
                  width="340"
                  height="475"
                  decoding="async"
                />
                {isDoubleFaced(card) && (
                  <Button 
                    appearance="primary" 
                    onClick={toggleFace}
                    style={{ marginTop: '10px', width: '100%' }}
                  >
                    {activeFace === 0 ? 'Show Back Face' : 'Show Front Face'}
                  </Button>
                )}
              </FlexboxGrid.Item>
            }
          </FlexboxGrid>
          {isAuthenticated && card && (
            <AddToCollectionModal
              open={showAddModal}
              onClose={() => setShowAddModal(false)}
              scryfallId={card.id}
              cardName={card.name}
              card={card}
            />
          )}
        </Content>
      </Container>
    </CustomProvider>
  );
}

export default CardView;