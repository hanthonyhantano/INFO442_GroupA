import { Link } from "react-router-dom";
import pasture from "../assets/discovery/pasture.jpg";
import { Principles } from "../discovery/Content";
export default function Mission() {
  return (
    <article className="dc dc-mission">
      <div className="dc-split">
        <div>
          <small>Our mission</small>
          <h1>Make the whole cow valuable.</h1>
          <p>
            Cat Cow connects small regenerative ranches with nearby shoppers,
            helping every cut find a place at the table.
          </p>
        </div>
        <img
          className="dc-pasture"
          src={pasture}
          alt="A cow standing on pasture"
        />
      </div>
      <Principles />
      <section className="dc-band">
        <h2>Ready to meet the people behind your beef?</h2>
        <Link to="/farms">Meet the farms →</Link>{" "}
        <Link to="/shop">Shop beef →</Link>
      </section>
    </article>
  );
}
