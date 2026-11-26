import { Link } from "react-router-dom";
import farmPhoto from "../assets/farm/farm3.jpg";

const STEPS = [
  {
    title: "Upload your cut sheet",
    text: "Tell us what came back from the processor, from ribeyes to oxtail.",
  },
  {
    title: "Set price & weight",
    text: "Choose your price per pound and package sizes for each cut.",
  },
  {
    title: "Confirm requests",
    text: "Review incoming orders and confirm the ones you can fill.",
  },
  {
    title: "Deliver or offer pickup",
    text: "Drop off nearby or let shoppers collect from your pickup spots.",
  },
];

const CONTACT_EMAIL = "producers@catcow.example";

export default function ForProducers() {
  return (
    <article className="dc dc-producers">
      <div className="dc-split">
        <div>
          {/* The page's main heading is "For producers" (matching the nav link),
              styled as the small label; the tagline below is styled large. */}
          <h1 className="dc-producers__eyebrow">For producers</h1>
          <p className="dc-producers__headline">Sell more of every animal.</p>
          <p>
            Cat Cow helps small ranches find buyers for every cut, not just the
            steaks, so less of each animal goes to waste.
          </p>
          <div className="dc-producers__actions">
            <Link to="/apply" className="dc-btn dc-btn--primary">
              Apply to sell
            </Link>
            <Link to="/sign-in" className="dc-btn">
              Producer sign in
            </Link>
          </div>
        </div>
        <img
          className="dc-pasture"
          src={farmPhoto}
          alt="Cattle grazing on a small ranch"
        />
      </div>

      <section className="dc-producers__steps" aria-labelledby="how-it-works">
        <small id="how-it-works">How it works</small>
        <ol>
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="dc-producers__num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="dc-producers__contact">
        <strong>Questions? We're happy to walk you through it.</strong>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </section>
    </article>
  );
}