import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CustomProvider,
  Container,
  Content,
  FlexboxGrid,
  Form,
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
            <FlexboxGrid justify="center" align="top">
              <FlexboxGrid.Item colspan={8} style={{ paddingRight: "10px" }}>
                <Panel bordered>
                  <h2 style={{ marginBottom: "25px"}}>{card?.name}</h2>
                  {card?.power && 
                    <>
                      <p><b>Power:</b> {card?.power}</p>
                      <p><b>Toughness:</b> {card?.toughness}</p>
                    </>
                  }
                  {card?.loyalty &&
                    <>
                      <p><b>Loyalty:</b> {card?.loyalty}</p>
                    </>
                  }
                  <p><b>Approximate Cost:</b> ${card?.prices?.usd || card?.prices?.usd_foil}</p>
                  <p><b>Set:</b> {card?.set_name}</p>
                  <p><b>Commander Legality:</b> {card?.legalities?.commander === "legal" ? "Legal" : "Not Legal"}</p>
                  <p><b>Standard Legality:</b> {card?.legalities?.standard === "legal" ? "Legal" : "Not Legal"}</p>
                  <p><b>Ability:</b> {card?.oracle_text}</p>
                  <h5 style={{marginTop: "25px"}}>Purchase Links</h5>
                  <p><a onClick={goToTCGPlayer}>TCG Player</a></p>
                  <p><a onClick={goToCardMarket}>Card Market</a></p>
                </Panel>
              </FlexboxGrid.Item>
            <FlexboxGrid.Item colspan={4}>
              <img
                src={card?.image_uris?.png}
                alt="new"
                height="475"
              />
            </FlexboxGrid.Item>
          </FlexboxGrid>
        </Content>
      </Container>
    </CustomProvider>
  );
}

export default CardView;
