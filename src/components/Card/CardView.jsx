import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import {
  CustomProvider,
  Container,
  Content,
  FlexboxGrid,
  Panel,
  Button
} from 'rsuite';

import CardStat from './CardStat';
import Link from '../Shared/Link';
import NavigationBar from '../Shared/NavigationBar';

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
  if (card?.image_uris?.png) {
    return card.image_uris.png;
  }
  if (card?.card_faces?.[faceIndex]?.image_uris?.png) {
    return card.card_faces[faceIndex].image_uris.png;
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

const CardView = () => {
  const {id} = useParams();
  const [card, setCard] =  useState();
  const [active, setActive] = useState('cardSearch');
  const [activeFace, setActiveFace] = useState(0);

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

  return (
    <CustomProvider theme="dark">
      <Container>
        <NavigationBar active={active} setActive={setActive} />
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
                </Panel>
              </FlexboxGrid.Item>
              
            {!isMobile &&
              <FlexboxGrid.Item colspan={4}>
                <img
                  src={getImageUri(card, activeFace)}
                  alt={card?.name || 'Card image'}
                  height="475"
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
        </Content>
      </Container>
    </CustomProvider>
  );
}

export default CardView;