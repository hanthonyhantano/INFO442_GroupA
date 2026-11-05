import { Link } from 'react-router-dom'
import { preview } from './catalog'
import './discovery.css'
export function CatalogState({ catalog, children }) {
  if (catalog.error)
    return (
      <p role="alert">
        Something went wrong. <button onClick={catalog.retry}>Try again</button>
      </p>
    )
  if (!catalog.data)
    return (
      <p className="dc-loading" role="status">
        Loading listings…
      </p>
    )
  return (
    <>
      {preview && (
        <small className="dc-preview">Preview catalog · Sample inventory</small>
      )}
      {children}
    </>
  )
}
export function CutCard({ cut, featured }) {
  return (
    <Link className="dc-card" to={'/shop/' + cut.id}>
      <div className="dc-photo">
        {cut.photo_url ? (
          <img src={cut.photo_url} alt="" />
        ) : (
          'Photo unavailable'
        )}
        {featured && <b>Farmer’s pick</b>}
      </div>
      <div className="dc-body">
        <small>{cut.farm.name}</small>
        <h3>{cut.name}</h3>
        <strong>${Number(cut.price_per_lb).toFixed(2)}/lb</strong>
        <p>
          {[
            cut.cooking_tag,
            cut.approx_weight_lb && '≈ ' + cut.approx_weight_lb + ' lb pkg',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {cut.available_packages != null && (
          <p>{cut.available_packages} packages available</p>
        )}
        <span>View cut →</span>
      </div>
    </Link>
  )
}
export function Principles() {
  return (
    <div className="dc-three">
      {[
        [
          'Regenerative grazing',
          'Moving cattle between pastures gives plants time to recover. Their roots hold soil in place and absorb water.',
        ],
        [
          'Whole-animal use',
          'Steaks make up only about 10% of the animal. Choosing a roast, shank, or brisket helps a ranch sell the rest of its harvest.',
        ],
        [
          'A shorter supply chain',
          'Distributors take a share of the price you pay. Buying directly connects your food dollars with the people who raised your beef.',
        ],
      ].map(([title, text]) => (
        <section key={title}>
          <h3>{title}</h3>
          <p>{text}</p>
        </section>
      ))}
    </div>
  )
}
