import assert from "node:assert/strict";
import { parseRoles, hasRole, primaryRole, serializeRoles, STUDIO_ROLES } from "../src/lib/auth/roles";

function main() {
  assert.deepEqual([...STUDIO_ROLES], ["admin", "chef", "partner", "instructor", "user"], "privilege order");

  assert.deepEqual(parseRoles("user"), ["user"]);
  assert.deepEqual(parseRoles("user,instructor"), ["instructor", "user"], "sorted by privilege");
  assert.deepEqual(parseRoles(" admin , user "), ["admin", "user"], "whitespace tolerated");
  assert.deepEqual(parseRoles("USER"), ["user"], "case-insensitive");
  assert.deepEqual(parseRoles("user,user"), ["user"], "deduped");

  // Unknown roles are DROPPED, never passed through — an unrecognised role must
  // never reach a guard that might treat it as valid.
  assert.deepEqual(parseRoles("superuser"), []);
  assert.deepEqual(parseRoles("user,superuser"), ["user"]);
  for (const empty of ["", "   ", ",,", null, undefined]) {
    assert.deepEqual(parseRoles(empty), [], `empty input: ${JSON.stringify(empty)}`);
  }

  assert.equal(hasRole("user,instructor", "instructor"), true);
  assert.equal(hasRole("user,instructor", "admin"), false);
  // Substring safety: "administrator" must NOT satisfy "admin".
  assert.equal(hasRole("administrator", "admin"), false);
  assert.equal(hasRole("", "admin"), false);
  assert.equal(hasRole(null, "admin"), false);
  assert.equal(hasRole(undefined, "user"), false);

  assert.equal(primaryRole("user,instructor"), "instructor");
  assert.equal(primaryRole("user,admin"), "admin");
  assert.equal(primaryRole("user"), "user");
  assert.equal(primaryRole(""), undefined);

  assert.equal(serializeRoles(["user", "instructor"]), "instructor,user", "serialize is privilege-sorted");
  assert.equal(parseRoles(serializeRoles(["admin", "user"])).length, 2, "round-trips");

  console.log("test-auth-roles: all assertions passed");
  process.exit(0);
}

main();
