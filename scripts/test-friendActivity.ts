import assert from "node:assert";
import { mapFriendActivity, type ActivityRow } from "../src/lib/friendActivity";

const base: ActivityRow = {
  user_id: "u1",
  profile: { id: "u1", name: "Asha", avatar_url: null },
  class_schedule: { id: "s1", start_time: new Date("2026-08-01T10:00:00Z"), class_model: { name: "Vinyasa" } },
};

// maps a complete row
const [row] = mapFriendActivity([base]);
assert.deepStrictEqual(row, {
  friendId: "u1",
  friendName: "Asha",
  friendAvatarUrl: null,
  scheduleId: "s1",
  className: "Vinyasa",
  startTime: "2026-08-01T10:00:00.000Z",
});

// drops rows with no schedule or no class_model
assert.strictEqual(mapFriendActivity([{ ...base, class_schedule: null }]).length, 0);
assert.strictEqual(
  mapFriendActivity([{ ...base, class_schedule: { ...base.class_schedule!, class_model: null } }]).length,
  0,
);

// null friend name → empty string, order preserved
const two = mapFriendActivity([
  { ...base, user_id: "a", profile: { id: "a", name: null, avatar_url: "x.jpg" }, class_schedule: { ...base.class_schedule!, id: "sa" } },
  { ...base, user_id: "b", class_schedule: { ...base.class_schedule!, id: "sb" } },
]);
assert.strictEqual(two[0].scheduleId, "sa");
assert.strictEqual(two[0].friendName, "");
assert.strictEqual(two[0].friendAvatarUrl, "x.jpg");
assert.strictEqual(two[1].scheduleId, "sb");

console.log("friendActivity OK");
