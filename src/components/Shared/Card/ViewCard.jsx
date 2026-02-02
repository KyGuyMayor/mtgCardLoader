import React from 'react';
import { FlexboxGrid, Content, Panel } from 'rsuite'

import CardStat from "../../Card/CardStat";

/**
 * Get the image URI for a card, handling double-faced cards
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

const ViewCard = ({ card }) => {
  const imageUri = getImageUri(card, 0);
  const oracleText = getOracleText(card);
  
  return (
    <Content style={{ marginTop: "15px" }}>
      <FlexboxGrid justify="center" align="top">
        <Panel bordered>
          <FlexboxGrid.Item colspan={6}>
            <h3>{card.name}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{oracleText}</p>
            <CardStat title="Mana Cost" value={card.mana_cost} />
          </FlexboxGrid.Item>
          <FlexboxGrid.Item colspan={6}>
            <h3>Card Image</h3>
            {imageUri && <img src={imageUri} alt={card.name} />}
          </FlexboxGrid.Item>
        </Panel>
      </FlexboxGrid>
    </Content>
  );
};

export default ViewCard;