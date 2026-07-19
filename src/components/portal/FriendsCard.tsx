import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { useFriendsGraph } from "@/hooks/useFriendsGraph";
import { FriendsLists } from "@/components/portal/FriendsLists";

export function FriendsCard() {
  const graph = useFriendsGraph();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl text-charcoal">Friends</CardTitle>
        <div className="flex items-center gap-2">
          {graph.friends.length > 0 && (
            <Pill tone="success" noIcon className="tabular-nums">{graph.friends.length} connected</Pill>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link href="/portal/friends">Manage</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <FriendsLists graph={graph} />
      </CardContent>
    </Card>
  );
}
