import { useState } from "react";
import CowDiagram from "../discovery/CowDiagram";
import { cuts } from "../discovery/cuts";
import { Link } from "react-router-dom";
import logo from "../assets/navigation/catcow.png";
import artwork from "../assets/discovery/home-art.png";
import "./home.css";
import { useCatalog } from "../discovery/useCatalog";
import { Principles, CatalogState, CutCard } from "../discovery/Content";
export default function Home() {
  const catalog = useCatalog();
  const [part, setPart] = useState("Chuck");
  return (
    <article className="dc dc-home">
      <header className="dc-split">
        <div>
          <small>Washington · Regenerative beef marketplace</small>
          <h1>
            Good beef.
            <br />
            More of it.
          </h1>
          <p>
            Discover cuts beyond the steak case and buy directly from small
            grass-fed ranches near you.
          </p>
          <div className="dc-actions">
            <Link to="/shop">Shop Beef</Link>
            <Link to="/explore">Explore the Cow</Link>
          </div>
          <p className="dc-tagline">From their pasture to your kitchen.</p>
        </div>
        <img
          className="home-art"
          src={artwork}
          alt="Cat Cow illustrated over a blue pasture"
        />
      </header>
      <section>
        <small>Underrated cuts</small>
        <div className="dc-heading">
          <h2>Farmers’ picks</h2>
          <Link to="/shop">See every cut →</Link>
        </div>
        <p>Discover cuts that ranchers want more people to try.</p>
        <CatalogState catalog={catalog}>
          {catalog.data?.featured.length ? (
            <div className="dc-grid">
              {catalog.data.featured.map((p) => (
                <CutCard key={p.id} cut={p} featured />
              ))}
            </div>
          ) : (
            <p>
              No farmer’s picks near you right now.{" "}
              <Link to="/farms">Explore farms</Link>
            </p>
          )}
        </CatalogState>
      </section>
      <section className="dc-band home-explorer">
        <div>
          <small>The cow explorer</small>
          <h2>Pick a part of the cow.</h2>
          <p>
            Learn where a cut comes from, how to cook it, and who has it in
            stock.
          </p>
          <p aria-live="polite">
            <strong>{part}</strong> · {cuts[part].slice(1).join(" · ")}
          </p>
          <Link to={"/explore?part=" + encodeURIComponent(part)}>
            Open the explorer →
          </Link>
        </div>
        <CowDiagram selected={part} onSelect={setPart} />
      </section>
      <section>
        <small>Meet the farmers</small>
        <h2>The ranches raising your beef</h2>
        <CatalogState catalog={catalog}>
          <div className="dc-three">
            {catalog.data?.farms.slice(0, 3).map((f) => (
              <Link
                className="dc-card dc-body"
                key={f.id}
                to={"/farms/" + f.id}
              >
                <div className="home-farm-photo">
                  {f.photo_url && <img src={f.photo_url} alt="" />}
                </div>
                <small>{f.town}</small>
                <h3>{f.name}</h3>
                <p>{f.description}</p>
                {f.operator && <p>{f.operator}</p>}
                {f.tags?.join(" · ")}
                <p>Visit farm →</p>
              </Link>
            ))}
          </div>
        </CatalogState>
      </section>
      <section className="home-mission">
        <div className="home-mission-copy">
          <small>Our mission</small>
          <h2>Make the whole cow valuable.</h2>
          <Link to="/mission">Our mission →</Link>
        </div>
        <Principles />
      </section>
      <footer className="home-footer">
        <div>
          <img src={logo} alt="Cat Cow" />
          <p>Stretch the cow. More for the farmer.</p>
        </div>
        <div>
          <small>Shop</small>
          <Link to="/shop">All cuts</Link>
          <Link to="/explore">Explore the cow</Link>
          <Link to="/cart">Cart</Link>
        </div>
        <div>
          <small>Mission</small>
          <Link to="/mission">Whole-animal use</Link>
          <Link to="/mission">Regenerative grazing</Link>
        </div>
        <div>
          <small>Producers</small>
          <Link to="/producer">Producer dashboard</Link>
          <Link to="/producers">Sell with Cat Cow</Link>
        </div>
        <div>
          <small>Contact</small>
          <p>Seattle, WA</p>
        </div>
      </footer>
    </article>
  );
}
