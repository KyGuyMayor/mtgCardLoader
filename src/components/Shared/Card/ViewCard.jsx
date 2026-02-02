import React from 'react';
import { FlexboxGrid, Content, Panel } from 'rsuite'

import CardStat from "../../Card/CardStat";

const ViewCard = ({ card }) => {
    console.log(card);
  return (
    <Content style={{ marginTop: "15px" }}>
      <FlexboxGrid justify="center" align="top">
        <Panel bordered>
          <FlexboxGrid.Item colspan={6}>
            <h3>{card.name}</h3>
            <p>{card.oracle_text}</p>
            <CardStat title="Mana Cost" value={card.mana_cost} />
          </FlexboxGrid.Item>
          <FlexboxGrid.Item colspan={6}>
            <h3>Card Image</h3>
            <img src={card.image_uris.normal} alt={card.name} />
          </FlexboxGrid.Item>
        </Panel>
      </FlexboxGrid>
    </Content>
  );
};

export default ViewCard;