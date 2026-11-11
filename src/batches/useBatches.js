import { useEffect, useState } from 'react';
import { supabase } from "/src/lib/supabase.js";

export function useFarmBatches(farmId) {
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
        .eq('farm_id', Number(farmId))          // URL params are strings; ids are int8
        .neq('status', 'archived')
        .order('processing_date', { ascending: false });
      if (!cancelled) { setBatches(data ?? []); setError(error); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [farmId]);

  return { batches, loading, error };
}