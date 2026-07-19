import { useEffect, useState, useCallback } from "react";
import {
  getFriends, getFriendRequests, getSuggestions,
  sendFriendRequest, respondToRequest, cancelRequest,
  type Friend, type Suggestion, type FriendRequests,
} from "@/services/friends";

export function useFriendsGraph() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      getFriends().then(setFriends),
      getFriendRequests().then(setRequests),
      getSuggestions().then(setSuggestions),
    ]).finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const onAdd = useCallback(async (id: string) => {
    if (await sendFriendRequest(id)) setRequested((s) => new Set([...s, id]));
  }, []);
  const onRespond = useCallback(async (id: string, action: "accept" | "decline") => {
    if (await respondToRequest(id, action)) reload();
  }, [reload]);
  const onCancel = useCallback(async (id: string) => {
    if (await cancelRequest(id)) reload();
  }, [reload]);

  const isEmpty =
    !loading && friends.length === 0 &&
    requests.incoming.length === 0 && requests.outgoing.length === 0 &&
    suggestions.length === 0;

  return { friends, requests, suggestions, requested, loading, isEmpty, onAdd, onRespond, onCancel, reload };
}
