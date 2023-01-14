import React, { useState, useEffect } from "react";
import logo from "../../assets/logo.png";
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from "../../../declarations/nft";
import { idlFactory as tokenIdlFactory } from "../../../declarations/token_backend";
import { Principal } from '@dfinity/principal';
import Button from "./Button";
import PriceLabel from "./PriceLabel";
import { opend_backend } from "../../../declarations/opend_backend";
import CURRENT_USER_ID from "../index";

function Item(props) {

  const [name, setName] = useState();
  const [owner, setOwner] = useState();
  const [image, setImage] = useState();
  const [button, setButton] = useState();
  const [priceLabel, setPrice] = useState();
  const [priceInput, setPriceInput] = useState();
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [shouldDisplay, setDisplay] = useState(true);
  const [blurEffect, setBlur] = useState();
  const [sellStatus, setSellStatus] = useState();

  const id = props.id;

  const localHost = "http://localhost:8080/";
  const agent = new HttpAgent({ host: localHost });
  //TODO: When deploy live, remove the following line
  agent.fetchRootKey();
  let NFTActor;

  async function loadNFT() {
    NFTActor = await Actor.createActor(idlFactory, {
      agent,
      canisterId: id,
    });

    const name = await NFTActor.getName();
    setName(name);

    const owner = await NFTActor.getOwner();
    setOwner(owner.toText());

    const imageData = await NFTActor.getAsset();
    const imageContent = new Uint8Array(imageData);
    const image = URL.createObjectURL(new Blob([imageContent.buffer], { type: "image/png" }));
    console.log(image, imageContent);
    setImage(image);

    if (props.role == "collection") {
      const nftIsListed = await opend_backend.isListed(props.id);
      if (nftIsListed) {
        setOwner("OpenD");
        setBlur({filter: "blur(4px)"});
        setSellStatus("Listed");
      } else {
        setButton(<Button handleClick={handleSell} text={"Sell"}/>);
      }
    } else if (props.role == "discover") {
      const originalOwner = await opend_backend.getOriginalOwner(props.id);
      if (originalOwner.toText() != CURRENT_USER_ID.toText()) {
        setButton(<Button handleClick={handleBuy} text={"Buy"}/>);
      }

      const price = await opend_backend.getListedNFTPrice(props.id);
      setPrice(<PriceLabel sellPrice={price.toString()}/>);

    }
    
  };

  useEffect(() => {
    loadNFT();
  }, []);

  let price;
  function handleSell() {
    setPriceInput(<input
      placeholder="Price in DANG"
      type="number"
      className="price-input"
      value={price}
      onChange={(e) => price=e.target.value }
    />);
    setButton(<Button handleClick={sellItem} text={"Confirm"}/>);
  };

  async function sellItem() {
    console.log("set price " + price);
    setBlur({filter: "blur(4px)"});
    setLoaderHidden(false);
    const listingResult = await opend_backend.listItem(props.id, Number(price));
    console.log("Listing Result: " + listingResult);
    if (listingResult == "Success") {
      const openDId = await opend_backend.getOpenDCanisterID();
      const transferResult = await NFTActor.transferOwnership(openDId, true);
      console.log("Transfer Result: " + transferResult);
      if (transferResult == "Success") {
        setLoaderHidden(true);
        setButton();
        setPriceInput();
        setOwner("OpenD");
        setSellStatus("Listed");
      }
    }
  }

  async function handleBuy() {
    console.log("Buy Triggered.");
    setLoaderHidden(false);
    const tokenActor = await Actor.createActor(tokenIdlFactory, {
      agent,
      canisterId: Principal.fromText("renrk-eyaaa-aaaaa-aaada-cai"),
    });

    const sellerId = await opend_backend.getOriginalOwner(props.id);
    const itemPrice = await opend_backend.getListedNFTPrice(props.id);

    const result = await tokenActor.transfer(sellerId, itemPrice);
    console.log(result);

    if (result == "Success") {
      const transferResult = await opend_backend.completePurchase(props.id, sellerId, CURRENT_USER_ID);
      console.log("Purchase Result: " + transferResult);
      setLoaderHidden(true);
      setDisplay(false);
    }
  }

  return (
    <div style={{display: shouldDisplay ? "inline" : "none"}} className="disGrid-item">
      <div className="disPaper-root disCard-root makeStyles-root-17 disPaper-elevation1 disPaper-rounded">
        <img
          className="disCardMedia-root makeStyles-image-19 disCardMedia-media disCardMedia-img"
          src={image}
          style={blurEffect}
        />
        <div hidden={loaderHidden} className="lds-ellipsis">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div className="disCardContent-root">
          {priceLabel}
          <h2 className="disTypography-root makeStyles-bodyText-24 disTypography-h5 disTypography-gutterBottom">
            {name}
            <span className="purple-text"> {sellStatus}</span>
          </h2>
          <p className="disTypography-root makeStyles-bodyText-24 disTypography-body2 disTypography-colorTextSecondary">
            Owner: {owner}
          </p>
          {priceInput}
          {button}
        </div>
      </div>
    </div>
  );
}

export default Item;
