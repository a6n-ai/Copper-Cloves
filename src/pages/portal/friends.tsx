import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SEO as Seo } from "@/components/SEO";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { useFriendsGraph } from "@/hooks/useFriendsGraph";
import { FriendsLists } from "@/components/portal/FriendsLists";
import { AddFriendSearch } from "@/components/portal/AddFriendSearch";
import { FriendActivityFeed } from "@/components/portal/FriendActivityFeed";
import { SharePassDialog } from "@/components/portal/SharePassDialog";
import { SharedWithYouCard } from "@/components/portal/SharedWithYouCard";
import type { Friend } from "@/services/friends";

export const getServerSideProps = requireSessionSSP({ roles: ["user"] });

export default function FriendsPage() {
  const graph = useFriendsGraph();
  const [shareTarget, setShareTarget] = useState<Friend | null>(null);
  // Ids already connected or with a pending outgoing request — hide "Add" for them.
  const existingIds = new Set<string>([
    ...graph.friends.map((f) => f.id),
    ...graph.requests.outgoing.map((r) => r.id),
    ...graph.requests.incoming.map((r) => r.id),
  ]);

  return (
    <>
      <Seo title="Friends & Family — The Studio" description="Connect with friends and see their upcoming classes" />
      <div className="min-h-screen bg-cream">
        <main className="pt-8 pb-16 min-h-screen">
          <div className="mx-auto mb-6 max-w-4xl px-4 sm:px-6 lg:px-8">
            <PageHeader title="Friends & Family" subtitle="Add people you know and see what they've got booked" />
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-xl text-charcoal">Your people</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <AddFriendSearch existingIds={existingIds} onSent={graph.reload} />
                <FriendsLists graph={graph} onFriendClick={setShareTarget} />
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-xl text-charcoal">Friends&apos; upcoming classes</CardTitle></CardHeader>
                <CardContent><FriendActivityFeed /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-xl text-charcoal">Shared with you</CardTitle></CardHeader>
                <CardContent><SharedWithYouCard /></CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
      <SharePassDialog
        friend={shareTarget}
        open={shareTarget !== null}
        onOpenChange={(o) => { if (!o) setShareTarget(null); }}
        onShared={() => setShareTarget(null)}
      />
    </>
  );
}
