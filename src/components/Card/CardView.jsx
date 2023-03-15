import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import {
  CustomProvider,
  Container,
  Content,
  FlexboxGrid,
  Panel
} from 'rsuite';

import CardStat from './CardStat';
import Link from '../Shared/Link';
import NavigationBar from '../Shared/NavigationBar';

const CardView = () => {
  const {id} = useParams();
  const [card, setCard] =  useState();
  const [active, setActive] = useState('cardSearch');

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
              <FlexboxGrid.Item colspan={isMobile ? 20 : 8} style={{ paddingRight: isMobile ? "0px" : "10px" }}>
                <Panel bordered>
                  <h2 style={{ marginBottom: "25px"}}>{card?.name}</h2>
                  {card?.power && 
                    <>
                      <CardStat title="Power" value={card?.power} />
                      <CardStat title="Toughness" value={card?.toughness} />
                    </>
                  }
                  {card?.loyalty &&
                    <>
                      <CardStat title="Loyalty" value={card?.loyalty} />
                      <p><b>Loyalty:</b> {card?.loyalty}</p>
                    </>
                  }
                  <CardStat title="Approximate Cost" value={"$" + card?.prices?.usd} />
                  {card?.prices.usd_foil &&
                    <CardStat title="Approximate Foil Cost" value={"$" + card?.prices?.usd_foil} />
                  }
                  <CardStat title="Set" value={card?.set_name} />
                  <CardStat title="Commander Legality" value={card?.legalities?.commander === "legal" ? "Legal" : "Not Legal"} />
                  <CardStat title="Standard Legality" value={card?.legalities?.standard === "legal" ? "Legal" : "Not Legal"} />
                  <CardStat title="Ability" value={card?.oracle_text} />
                  <h5 style={{marginTop: "25px"}}>Purchase Links</h5>
                  <Link url={card?.purchase_uris?.tcgplayer} title="TCG Player" />
                  <Link url={card?.purchase_uris?.cardmarket} title="Card Market" />
                </Panel>
              </FlexboxGrid.Item>
              
            {!isMobile &&
              <FlexboxGrid.Item colspan={4}>
                <img
                  src={card?.image_uris?.png}
                  alt="new"
                  height="475"
                />
              </FlexboxGrid.Item>
            }
          </FlexboxGrid>
        </Content>
      </Container>
    </CustomProvider>
  );
}

export default CardView;
