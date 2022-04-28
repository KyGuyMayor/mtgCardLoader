import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Content } from 'rsuite';

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
    <>
      <Container>
        <NavigationBar active={active} setActive={setActive} />
          <Content>
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
        </Content>
      </Container>
    </>
  );
}

export default CardView;