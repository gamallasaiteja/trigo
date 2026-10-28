// Turns a chat message into tasks placed on an impact × urgency matrix.
// This is the offline sorter; ai.js does the same job with Claude when a key is set.

export const QUADRANTS = {
  do: { label: "Do now", hint: "High impact · urgent", example: "e.g. client report due at 3pm" },
  plan: { label: "Schedule", hint: "High impact · not urgent", example: "e.g. gym, plan next quarter" },
  quick: { label: "Quick / delegate", hint: "Low impact · urgent", example: "e.g. clear inbox today" },
  later: { label: "Later / drop", hint: "Low impact · not urgent", example: "e.g. sort old photos someday" },
};
export const QUADRANT_ORDER = ["do", "plan", "quick", "later"];

export function quadrantFor(highImpact, urgent) {
  if (highImpact) return urgent ? "do" : "plan";
  return urgent ? "quick" : "later";
}

// Older tasks (made before the matrix existed) have no quadrant.
export const quadrantOf = (task) => (QUADRANTS[task.quadrant] ? task.quadrant : "plan");

const URGENT = [
  [/\b(asap|urgent(ly)?|immediately|right away|right now)\b/, "urgent"],
  [/\b(today|tonight|this (morning|afternoon|evening))\b/, "today"],
  [/\b(overdue|deadline|due (today|tomorrow|tonight|noon|by|at))\b/, "deadline"],
  [/\bdue \d{1,2}(:\d{2})?\s*(am|pm)\b/, "deadline"],
  [/\b(by|before|at) \d{1,2}(:\d{2})?\s*(am|pm)?\b/, "has a set time"],
  [/\b(eod|end of (the )?day|by noon|by lunch)\b/, "due today"],
  [/!/, "you flagged it"],
];
const NOT_URGENT = [
  [/\b(someday|eventually|whenever|no rush|next (week|month)|this (week|month)|at some point)\b/, "no rush"],
];
const HIGH_IMPACT = [
  [/\b(important|critical|crucial|priority|high impact|must)\b/, "you said it matters"],
  [/\b(clients?|customers?|boss|manager|team|investors?|board|stakeholders?)\b/, "others depend on it"],
  [/\b(report|proposal|presentation|pitch|deck|launch|release|ship|deploy|contract|deal|project|strategy|roadmap|interview|hire|hiring)\b/, "core work"],
  [/\b(exam|study|thesis|assignment|homework|course|revise)\b/, "your goals"],
  [/\b(doctor|dentist|hospital|medicine|meds|health|therapy|workout|gym|exercise|run)\b/, "health"],
  [/\b(tax(es)?|rent|bills?|invoices?|pay|payment|loan|insurance|visa|passport)\b/, "money or legal stakes"],
  [/\b(mom|mum|dad|parents|kids?|son|daughter|wife|husband|partner|family)\b/, "family"],
];
const LOW_IMPACT = [
  [/\b(low priority|not important|optional|maybe|if (i have )?time)\b/, "you said it's optional"],
  [/\b(inbox|emails|notifications|slack|whatsapp)\b/, "routine admin"],
  [/\b(tidy|clean|organi[sz]e|declutter|laundry|dishes|groceries|errands?|shopping)\b/, "chore"],
  [/\b(browse|scroll|youtube|netflix|tv|social media|instagram|twitter|reddit)\b/, "leisure"],
];

const TAG = /#(do|plan|quick|later)\b/i;

function matches(rules, text) {
  return rules.filter(([re]) => re.test(text)).map(([, why]) => why);
}

export function cleanTitle(raw) {
  let t = raw
    .replace(TAG, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/^\s*(?:i\s+)?(?:need|want|have|got|plan|ought)\s+to\s+/i, "")
    .replace(/^\s*(?:i\s+)?(?:should|must|gotta|will)\s+/i, "")
    .replace(/^\s*to\s+/i, "")
    .replace(/[\s.,;]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

const CONTINUATION = /^(due|by|before|after|at|for|with|about|on|until|then|so|because|which|that|no rush|asap|urgent(ly)?|today|tonight|tomorrow|someday)\b/i;

// One task per line, semicolon or bullet. Commas split too when every part
// reads like its own short task ("gym, call mom, groceries") rather than a
// detail of the previous one ("email Priya, due Friday").
export function splitRaw(text) {
  let body = text.trim();
  const colon = body.match(/^([^:\n]{0,40}):\s*(.+)$/s);
  if (colon && /\b(today|want|need|plan|to-?do|list|tasks?)\b/i.test(colon[1])) body = colon[2];

  const parts = [];
  for (const line of body.split(/\n|;|\s+[•·]\s+/)) {
    const commaParts = line.split(/,\s*(?:and\s+)?/).map((s) => s.trim()).filter(Boolean);
    const splittable = commaParts.length > 1 &&
      commaParts.every((p) => p.split(/\s+/).length <= 6 && !CONTINUATION.test(p));
    parts.push(...(splittable ? commaParts : [line]));
  }
  return parts.map((p) => p.trim()).filter((p) => cleanTitle(p).length > 1);
}

export const splitTasks = (text) => splitRaw(text).map(cleanTitle);

// Classify one task title. Explicit #do/#plan/#quick/#later wins.
export function classifyLocal(rawTitle) {
  const tag = rawTitle.match(TAG);
  const title = cleanTitle(rawTitle);
  if (tag) return { title, quadrant: tag[1].toLowerCase(), reason: "you tagged it" };

  const text = rawTitle.toLowerCase();
  const urgentWhy = matches(URGENT, text);
  const calmWhy = matches(NOT_URGENT, text);
  const highWhy = matches(HIGH_IMPACT, text);
  const lowWhy = matches(LOW_IMPACT, text);

  const urgent = urgentWhy.length > 0 && calmWhy.length === 0;
  // Unknown impact defaults to high: you typed it into your plan for a reason.
  const highImpact = highWhy.length >= lowWhy.length;

  const reasons = [...(urgent ? urgentWhy : calmWhy), ...(highImpact ? highWhy : lowWhy)];
  const reason = reasons.length
    ? [...new Set(reasons)].slice(0, 2).join(", ")
    : "no deadline mentioned";
  return { title, quadrant: quadrantFor(highImpact, urgent), reason };
}

// Plain-language reply for the chat after sorting.
// `lead` (Claude's own reply) replaces the default "Start with …" line.
export function describeSorted(added, skipped = [], lead = null) {
  if (!added.length && !skipped.length) {
    return "Tell me what you want to get done. One per line, or separate them with commas.";
  }
  const lines = lead ? [lead] : [];
  if (added.length) {
    lines.push(`Added ${added.length} to your matrix:`);
    for (const t of added) lines.push(`• ${QUADRANTS[t.quadrant].label}: ${t.title} (${t.reason})`);
  }
  if (skipped.length) lines.push(`Already on your list: ${skipped.join(", ")}.`);
  const first = added.find((t) => t.quadrant === "do");
  if (first && !lead) lines.push(`Start with “${first.title}”.`);
  if (added.length) lines.push("Tap a task to move it if I got it wrong.");
  return lines.join("\n");
}

// Greetings and questions shouldn't become tasks.
export function isChatter(text) {
  const t = text.trim().toLowerCase();
  return /^(hi|hello|hey|yo|thanks|thank you|ok|okay|good (morning|afternoon|evening)|morning|help)\b[\s!.]*$/.test(t) ||
    (/\?\s*$/.test(t) && !t.includes("\n"));
}
