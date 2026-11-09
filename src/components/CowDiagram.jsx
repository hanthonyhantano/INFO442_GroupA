import { useId, useState } from "react";
 
export const COW_PARTS = [
  {
    id: "cheek",
    label: "Cheek",
    lx: 150,
    ly: 150,
    d: "M8,62 L35,52 L85,55 L95,40 L90,18 L105,15 L115,40 L135,50 L175,45 L190,15 L210,15 L215,45 L240,60 L298,68 L300,85 L258,118 L218,232 L200,222 L175,225 L140,230 L90,235 L55,215 L50,195 L65,165 L80,135 L50,105 L8,85 Z",
  },
  {
    id: "chuck",
    label: "Chuck",
    lx: 315,
    ly: 172,
    d: "M258,118 L405,110 L407,225 L218,232 Z",
  },
  {
    id: "rib",
    label: "Rib",
    lx: 465,
    ly: 172,
    d: "M407,110 L450,117 L522,135 L522,225 L407,225 Z",
  },
  {
    id: "loin",
    label: "Loin",
    lx: 569,
    ly: 172,
    d: "M522,135 L570,120 L615,102 L615,225 L522,225 Z",
  },
  {
    id: "sirloin",
    label: "Sirloin",
    lx: 650,
    ly: 172,
    d: "M615,102 L650,100 L690,112 L680,225 L615,225 Z",
  },
  {
    id: "round",
    label: "Round",
    lx: 672,
    ly: 312,
    d: "M615,225 L680,225 L700,228 L712,252 L726,288 L738,330 L748,372 L750,430 L748,480 L740,508 L712,526 L680,514 L666,484 L668,424 L659,402 L651,440 L650,480 L646,512 L600,522 L572,505 L562,462 L572,424 L584,404 L584,376 L612,376 Z",
  },
  {
    id: "brisket",
    label: "Brisket",
    lx: 305,
    ly: 275,
    d: "M203,228 L218,232 L407,225 L407,317 L225,317 Z",
  },
  {
    id: "plate",
    label: "Plate",
    lx: 465,
    ly: 290,
    d: "M407,225 L522,225 L522,335 L470,352 L410,350 L407,317 Z",
  },
  {
    id: "flank",
    label: "Flank",
    lx: 568,
    ly: 298,
    d: "M522,225 L615,225 L612,375 L583,375 L575,350 L522,335 Z",
  },
  {
    id: "shank",
    label: "Shank",
    lx: 305,
    ly: 462,
    d: "M225,317 L260,350 L275,390 L258,410 L235,450 L230,480 L240,505 L270,515 L297,505 L315,510 L340,513 L365,510 L385,500 L405,480 L400,445 L390,400 L392,370 L410,350 L407,317 Z",
  },
  {
    id: "tail",
    label: "Tail",
    lx: 762,
    ly: 322,
    d: "M690,112 L722,140 L738,182 L752,240 L788,292 L795,336 L782,374 L748,372 L738,330 L726,288 L712,252 L700,228 L680,225 Z",
  },
];
 
/**
 * Props
 *  - selected:        id of the selected part. Pass it (with onSelect) to control the
 *                     diagram, or leave it undefined to let the diagram manage itself.
 *                     Pass null for "nothing selected".
 *  - defaultSelected: starting part when uncontrolled (default "chuck")
 *  - onSelect(id):    called when the shopper picks a part
 *  - interactive:     false = display only (no hover, no clicks), e.g. product page
 *  - showLabels:      draw each part's name on the diagram
 *  - showButtons:     draw the row of 11 part buttons under the diagram
 */
export default function CowDiagram({
  selected,
  defaultSelected = "chuck",
  onSelect,
  interactive = true,
  showLabels = true,
  showButtons = true,
  className = "",
}) {
  const clipId = `cow-clip-${useId().replace(/:/g, "")}`;
  const [inner, setInner] = useState(defaultSelected);
 
  const isControlled = selected !== undefined;
  const current = isControlled ? selected : inner;
 
  const select = (id) => {
    if (!interactive) return;
    if (!isControlled) setInner(id);
    onSelect?.(id);
  };
 
  // Keyboard fallback for when the button row is hidden.
  const keyboardProps = (id) =>
    showButtons
      ? { tabIndex: -1 }
      : {
          tabIndex: 0,
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              select(id);
            }
          },
        };
 
  return (
    <div className={`cow-diagram ${className}`.trim()}>
      <svg
        className="cow-diagram__svg"
        viewBox="0 0 810 540"
        role={interactive ? "group" : "img"}
        aria-label={
          interactive
            ? "Cow diagram divided into 11 cuts"
            : `Cow diagram${current ? `, ${current} highlighted` : ""}`
        }
      >
        <defs>
          <clipPath id={clipId}>
            {COW_PARTS.map((p) => (
              <path key={p.id} d={p.d} />
            ))}
          </clipPath>
        </defs>
 
        {/* gray outline around the whole cow */}
        <g className="cow-outline" aria-hidden="true">
          {COW_PARTS.map((p) => (
            <path key={p.id} d={p.d} />
          ))}
        </g>
 
        <g clipPath={`url(#${clipId})`}>
          {COW_PARTS.map((p) => {
            const isSelected = current === p.id;
            return (
              <g
                key={p.id}
                className={[
                  "cow-part",
                  interactive ? "is-interactive" : "",
                  isSelected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                {...(interactive
                  ? {
                      role: "button",
                      "aria-label": p.label,
                      "aria-pressed": isSelected,
                      onClick: () => select(p.id),
                      ...keyboardProps(p.id),
                    }
                  : {})}
              >
                <path d={p.d} />
                {showLabels && (
                  <text className="cow-part__label" x={p.lx} y={p.ly} dy=".35em">
                    {p.label.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
 
      {showButtons && (
        <div className="cow-buttons" role="group" aria-label="Choose a cut">
          {COW_PARTS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`cow-button ${current === p.id ? "is-active" : ""}`}
              aria-pressed={current === p.id}
              onClick={() => select(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}