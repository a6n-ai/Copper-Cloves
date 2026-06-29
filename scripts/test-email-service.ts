import assert from "node:assert/strict";
import { formatRupeesFromPaise, studioLinks } from "../src/lib/notifications/email/variables";

assert.equal(formatRupeesFromPaise(94500), "₹945");
assert.equal(formatRupeesFromPaise(0), "₹0");
const links = studioLinks("https://x.in");
assert.equal(links.Studio_Link, "https://x.in");
assert.equal(links.Portal_Link, "https://x.in/portal/dashboard");

console.log("email-service: all assertions passed");

import { EMAIL_KINDS } from "../src/lib/notifications/email/kinds";

// Every kind's codeBuilder, rendered with its declared palette as stub values,
// must leave no {{token}} unresolved that is NOT in the declared palette.
for (const [name, kind] of Object.entries(EMAIL_KINDS)) {
  const stub: Record<string, string> = {};
  for (const v of kind.variables) stub[v] = `<${v}>`;
  const html = kind.codeBuilder(stub);
  const leftover = html.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
  assert.deepEqual(leftover, [], `${name} codeBuilder leftover tokens: ${leftover}`);
}
console.log("email-service: kinds assertions passed");

import { renderEmail, validateBodyVariables } from "../src/lib/notifications/email/sendStudioEmail";

assert.deepEqual(
  validateBodyVariables("hi {{Member_Name}} {{Bogus}}", ["Member_Name"]),
  ["Bogus"],
);
// CRM body wins when present; declared vars resolve, none left over.
const r = renderEmail(
  {
    templateKey: "x",
    variables: ["Member_Name"],
    subject: "Hi {{Member_Name}}",
    buildVars: () => ({}),
    codeBuilder: () => "<p>code</p>",
  } as any,
  { Member_Name: "Asha" },
  "<p>hi {{Member_Name}}</p>",
);
assert.equal(r.subject, "Hi Asha");
assert.equal(r.html.includes("Asha"), true);
assert.equal(/\{\{/.test(r.html), false);
// Falls back to codeBuilder when no template body.
const r2 = renderEmail(
  { templateKey: "x", variables: [], subject: "S", buildVars: () => ({}), codeBuilder: () => "<p>code</p>" } as any,
  {},
  null,
);
assert.equal(r2.html, "<p>code</p>");
console.log("email-service: send assertions passed");
