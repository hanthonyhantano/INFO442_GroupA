import { useEffect, useState } from 'react';
import { supabase } from "/src/lib/supabase.js";

export default function FarmBatches({ farmId }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_code, animal, processor_name, processing_date, status, cuts ( id, name, photo )')
        .eq('farm_id', Number(farmId))
        .order('processing_date', { ascending: false });

      if (!cancelled) {
        setBatches(data ?? []);
        setError(error);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [farmId]);

  if (loading) return <p className="farm-batches__msg">Loading batches…</p>;
  if (error) return <p className="farm-batches__msg">Couldn't load batches.</p>;
  if (!batches.length) return <p className="farm-batches__msg">No batches right now.</p>;

  return (
    <section className="farm-batches">
      <h2 className="farm-batches__title">Current batches</h2>
      {batches.map((b) => (
        <article key={b.id} className="farm-batch">
          <h3 className="farm-batch__name">{b.batch_code} · {b.animal}</h3>
          <p className="farm-batch__meta">
            Processed {b.processing_date ?? 'TBD'}
            {b.processor_name && ` by ${b.processor_name}`}
          </p>
          <span className={`farm-batch__status farm-batch__status--${b.status}`}>{b.status}</span>
          {b.cuts.length > 0 && (
            <ul className="farm-batch__cuts">
              {b.cuts.map((c) => <li key={c.id}>{c.name}</li>)}
            </ul>
          )}
        </article>
      ))}
    </section>
  );
}