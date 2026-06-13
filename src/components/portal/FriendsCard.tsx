import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cdnUrl } from "@/lib/cdnUrl";
import {
  getFriends, getFriendRequests, getSuggestions,
  sendFriendRequest, respondToRequest, cancelRequest,
  type Friend, type Suggestion, type FriendRequests,
} from "@/services/friends";

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (avatarUrl) return <img src={cdnUrl(avatarUrl)} alt={name} className="w-9 h-9 rounded-full object-cover" />;
  return <div className="w-9 h-9 rounded-full bg-[#8f9779] text-white flex items-center justify-center text-xs font-semibold">{initials}</div>;
}

export function FriendsCard() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    getFriends().then(setFriends);
    getFriendRequests().then(setRequests);
    getSuggestions().then(setSuggestions);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onAdd(id: string) {
    if (await sendFriendRequest(id)) setRequested((s) => new Set([...s, id]));
  }
  async function onRespond(id: string, action: "accept" | "decline") {
    if (await respondToRequest(id, action)) load();
  }
  async function onCancel(id: string) {
    if (await cancelRequest(id)) load();
  }

  return (
    <Card className="border-[#e5e4dc] bg-[#fafaf8]">
      <CardHeader>
        <CardTitle className="font-display text-xl text-[#333333]">Friends</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {requests.incoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[#6b6b6b]">Friend requests</p>
            {requests.incoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={r.name} avatarUrl={r.avatar_url} />
                  <span className="text-sm text-[#333333] truncate">{r.name}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="bg-[#8f9779] text-white hover:bg-[#7a8b6c]" onClick={() => onRespond(r.id, "accept")}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => onRespond(r.id, "decline")}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {requests.outgoing.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[#6b6b6b]">Sent requests</p>
            {requests.outgoing.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={r.name} avatarUrl={r.avatar_url} />
                  <span className="text-sm text-[#333333] truncate">{r.name}</span>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => onCancel(r.id)}>
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {friends.length === 0 ? (
            <p className="text-sm text-[#6b6b6b]">Invite friends to a class and they&apos;ll show up here.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Avatar name={f.name} avatarUrl={f.avatar_url} />
                  <span className="text-sm text-[#333333]">{f.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[#6b6b6b]">People you may know</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 border border-[#e5e4dc] rounded-lg px-2.5 py-1.5">
                  <Avatar name={s.name} avatarUrl={s.avatar_url} />
                  <div className="min-w-0">
                    <div className="text-sm text-[#333333] truncate">{s.name}</div>
                    <div className="text-xs text-[#6b6b6b]">{s.mutualCount} mutual</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={requested.has(s.id)}
                    onClick={() => onAdd(s.id)}
                  >
                    {requested.has(s.id) ? "Requested" : "Add friend"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
