import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CustomProvider,
  Container,
  Content,
  FlexboxGrid,
  Panel
} from 'rsuite';

import NavigationBar from './NavigationBar';

const CardView = () => {
  const {id}= useParams();
  const [card, setCard] =  useState();
  const [active, setActive] = useState('cardSearch');

  const goToTCGPlayer = () => {
    window.open(card?.purchase_uris?.tcgplayer);
  };

  const goToCardMarket = () => {
    window.open(card?.purchase_uris?.cardmarket);
  };

  useEffect(() => {
    const fetchData = async () => {
      const cardData  = await fetch(`/cards/${id}`);
      const cardJSON = await cardData.json();
      console.log(cardJSON);
      setCard(cardJSON);
    } 
       
    fetchData();
  }, [id]);

  return (
    <CustomProvider theme="dark">
      <Container>
        <NavigationBar active={active} setActive={setActive} />
          <Content style={{ marginTop: "15px" }}>
            <FlexboxGrid justify="center">
            <FlexboxGrid.Item colspan={8} style={{ paddingRight: "10px" }}>
              <Panel bordered>
            <div>
              <p>Name: {card?.name}</p>
              <p>Power: {card?.power}</p>
              <p>Toughness: {card?.toughness}</p>
              <p>Approximate Cost: ${card?.prices?.usd || card?.prices?.usd_foil}</p>
              <p>Set: {card?.set_name}</p>
              <p>Commander Legality: {card?.legalities?.commander === "legal" ? "Legal" : "Not Legal"}</p>
              <p>Ability: {card?.oracle_text}</p>
              <p><a onClick={goToTCGPlayer}>TCG Player</a></p>
              <p><a onClick={goToCardMarket}>Card Market</a></p>
          </div>
          </Panel>
            </FlexboxGrid.Item>
            <FlexboxGrid.Item colspan={4}>
                <img
                  src={card?.image_uris?.normal}
                  alt="new"
                  height="500"
                />
            </FlexboxGrid.Item>
          </FlexboxGrid>
        </Content>
      </Container>
    </CustomProvider>
  );
}

export default CardView;