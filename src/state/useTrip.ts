import { useEffect, useState } from "react";
import { api } from "../api/client";

export function useTrip() {
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.state().then(setState).catch(e => setError(e.message)); }, []);
  return { state, error };
}
