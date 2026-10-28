import { test } from "node:test";
import assert from "node:assert/strict";
import { splitTasks, classifyLocal, cleanTitle, quadrantOf, describeSorted } from "./classify.js";

test("splits lines, semicolons, bullets and short comma lists", () => {
  assert.deepEqual(splitTasks("finish report\n- call mom; gym"), ["Finish report", "Call mom", "Gym"]);
  assert.deepEqual(splitTasks("gym, call mom, and buy groceries"), ["Gym", "Call mom", "Buy groceries"]);
  assert.deepEqual(splitTasks("Today I want to: pay rent, book dentist"), ["Pay rent", "Book dentist"]);
});

test("keeps a comma detail with its task", () => {
  assert.deepEqual(splitTasks("Email Priya about the Q3 numbers, due Friday"),
    ["Email Priya about the Q3 numbers, due Friday"]);
  assert.deepEqual(splitTasks("pay the bill, no rush"), ["Pay the bill, no rush"]);
});

test("cleans filler from titles", () => {
  assert.equal(cleanTitle("I need to finish the deck."), "Finish the deck");
  assert.equal(cleanTitle("1) should call the bank"), "Call the bank");
  assert.equal(splitTasks("hi").length, 1); // "Hi" is kept; the chat decides what to do with it
});

test("places tasks in the four quadrants", () => {
  assert.equal(classifyLocal("Send the client proposal by 3pm").quadrant, "do");
  assert.equal(classifyLocal("Work on the product roadmap").quadrant, "plan");
  assert.equal(classifyLocal("Clear my inbox today").quadrant, "quick");
  assert.equal(classifyLocal("Organize the garage someday").quadrant, "later");
});

test("'no rush' overrides urgency and tags override everything", () => {
  assert.equal(classifyLocal("Pay the bill today, no rush").quadrant, "plan");
  const tagged = classifyLocal("Scroll instagram #do");
  assert.equal(tagged.quadrant, "do");
  assert.equal(tagged.title, "Scroll instagram");
});

test("reasons name the signals", () => {
  assert.match(classifyLocal("Finish client report today").reason, /today/);
  assert.equal(classifyLocal("Repaint the fence").reason, "no deadline mentioned");
});

test("old tasks without a quadrant default to Schedule", () => {
  assert.equal(quadrantOf({}), "plan");
  assert.equal(quadrantOf({ quadrant: "quick" }), "quick");
});

test("chat reply points at the first urgent task", () => {
  const reply = describeSorted([{ title: "Ship fix", quadrant: "do", reason: "today" }], ["Gym"]);
  assert.match(reply, /Do now: Ship fix/);
  assert.match(reply, /Already on your list: Gym/);
  assert.match(reply, /Start with “Ship fix”/);
});

test("greetings and questions are chatter, task lists are not", async () => {
  const { isChatter } = await import("./classify.js");
  assert.equal(isChatter("Good morning!"), true);
  assert.equal(isChatter("what should I do?"), true);
  assert.equal(isChatter("gym, call mom"), false);
});

test("raw split keeps #tags so they still steer sorting", async () => {
  const { splitRaw } = await import("./classify.js");
  const parts = splitRaw("scroll reddit #do, laundry");
  assert.deepEqual(parts.map((p) => classifyLocal(p).quadrant), ["do", "later"]);
});

test("a bare 'due 3pm' counts as urgent", () => {
  assert.equal(classifyLocal("Client report due 3pm").quadrant, "do");
  assert.equal(classifyLocal("Rent due 10:30am").quadrant, "do");
});
