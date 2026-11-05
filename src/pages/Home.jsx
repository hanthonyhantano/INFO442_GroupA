import { Link } from 'react-router-dom'
import logo from '../assets/navigation/catcow.png'
import pasture from '../assets/discovery/pasture.jpg'
import { useCatalog } from '../discovery/useCatalog'
import { Principles, CatalogState, CutCard } from '../discovery/Content'
export default function Home() {
  const catalog = useCatalog()
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
        <div
          className="dc-art"
          style={{
            backgroundImage:
              'linear-gradient(#406fa899,#406fa899), url(' + pasture + ')',
          }}
        >
          <img src={logo} alt="Cat Cow" />
        </div>
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
              No farmer’s picks near you right now.{' '}
              <Link to="/farms">Explore farms</Link>
            </p>
          )}
        </CatalogState>
      </section>
      <section className="dc-band">
        <small>The cow explorer</small>
        <h2>Pick a part of the cow.</h2>
        <p>
          Learn where a cut comes from, how to cook it, and who has it in stock.
        </p>
        <Link to="/explore">Open the explorer →</Link>
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
                to={'/farms/' + f.id}
              >
                {f.photo_url && <img src={f.photo_url} alt="" />}
                <small>{f.town}</small>
                <h3>{f.name}</h3>
                <p>{f.description}</p>
                {f.operator && <p>{f.operator}</p>}
                {f.tags?.join(' · ')}
                <p>Visit farm →</p>
              </Link>
            ))}
          </div>
        </CatalogState>
      </section>
      <section>
        <small>Our mission</small>
        <h2>Make the whole cow valuable.</h2>
        <Principles />
        <Link to="/mission">Our mission →</Link>
      </section>
    </article>
  )
}
