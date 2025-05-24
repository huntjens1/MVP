import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || '';

export default function BackendHealth() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/api/health`)
      .then(res => res.json())
      .then(data => setStatus(data.status || 'Unknown'))
      .catch(() => setStatus('Error'));
  }, []);

  return (
    <div>
      <h3>Backend status: {status}</h3>
    </div>
  );
}
