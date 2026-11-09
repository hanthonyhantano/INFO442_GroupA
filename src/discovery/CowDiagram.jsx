import outline from "../assets/discovery/cow.svg";
import mask from "../assets/discovery/cow-mask.svg";
import regions from "../assets/discovery/cow-parts.svg?raw";
import { cuts } from "./cuts";
// The Figma illustration has two leg regions for Shank.
const regionsInOrder = [
  "Cheek",
  "Chuck",
  "Rib",
  "Loin",
  "Sirloin",
  "Round",
  "Tail",
  "Brisket",
  "Plate",
  "Flank",
  "Shank",
  "Shank",
];
const labels = [
  [15, 28],
  [40, 34],
  [58, 34],
  [71, 34],
  [81, 34],
  [84, 59],
  [96, 66],
  [37, 52],
  [58, 55],
  [70, 55],
  [32, 90],
];
export default function CowDiagram({ selected, onSelect }) {
  const selectedIds = regionsInOrder.flatMap((part, i) =>
    part === selected
      ? [".dc-regions #" + (i === 0 ? "Vector" : "Vector_" + (i + 1))]
      : [],
  );
  function pick(event) {
    const id = event.target.closest("path")?.id;
    if (!id) return;
    const part = regionsInOrder[(Number(id.split("_")[1]) || 1) - 1];
    if (part) onSelect(part);
  }
  return (
    <div className="dc-diagram">
      <div className="dc-cow" aria-hidden="true">
        <img src={outline} alt="" />
        <style>
          {selectedIds.join(",") + " {fill:#1a1a1a;fill-opacity:1}"}
        </style>
        <div
          className="dc-regions"
          style={{ maskImage: "url(" + JSON.stringify(mask) + ")" }}
          onClick={pick}
          dangerouslySetInnerHTML={{ __html: regions }}
        />
        {labels.map(([x, y], i) => (
          <span
            key={i}
            style={{
              left: x + "%",
              top: y + "%",
              color: regionsInOrder[i] === selected ? "white" : undefined,
            }}
          >
            {regionsInOrder[i]}
          </span>
        ))}
      </div>
      <div className="dc-tabs" aria-label="Cow parts">
        {Object.keys(cuts).map((part) => (
          <button
            key={part}
            aria-pressed={part === selected}
            onClick={() => onSelect(part)}
          >
            {part}
          </button>
        ))}
      </div>
    </div>
  );
}
