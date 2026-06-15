export interface SavedPosition {
  id: string;
  name: string;
  fen: string;
  folders: string[];
  times_played: number;
  analysis_count: number;
  created_at: string;
  updated_at: string;
}

export async function getSavedPositions(): Promise<SavedPosition[]> {
  const res = await fetch("/api/positions", { credentials: "include" });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return [];
    throw new Error("Failed to fetch saved positions");
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Unknown error");
  return data.positions;
}

export async function savePosition(name: string, fen: string, folders: string[] = []): Promise<SavedPosition> {
  const res = await fetch("/api/positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, fen, folders }),
    credentials: "include"
  });
  if (!res.ok) throw new Error("Failed to save position");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Unknown error");
  return data.position;
}

export async function updatePosition(id: string, name: string, folders: string[] = []): Promise<void> {
  const res = await fetch(`/api/positions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folders }),
    credentials: "include"
  });
  if (!res.ok) throw new Error("Failed to update position");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Unknown error");
}

export async function deletePosition(id: string): Promise<void> {
  const res = await fetch(`/api/positions/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!res.ok) throw new Error("Failed to delete position");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Unknown error");
}
