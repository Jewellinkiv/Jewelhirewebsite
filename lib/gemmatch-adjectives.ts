// Client-safe JewelCert adjectives — TEXT ONLY, no profile mapping.
//
// The taker imports THIS instead of `ADJECTIVES` from lib/gemmatch (which pairs
// each word with the trait it scores into — the answer key). Importing that into
// a client component shipped the key to the browser, letting a candidate game
// their result. Scoring stays server-side (lib/gemmatch). Keep these 48 words in
// sync with lib/gemmatch's ADJECTIVES; only the profile pairing is withheld here.

const ADJECTIVE_TEXTS = [
  // (order intentionally shuffled across traits; the taker also shuffles on mount)
  "Strategic", "Friendly", "Dependable", "Competitive",
  "Analytical", "Outgoing", "Patient", "Ambitious",
  "Big-picture", "Warm", "Organized", "Bold",
  "Inventive", "Persuasive", "Careful", "Confident",
  "Curious", "Charming", "Consistent", "Driven",
  "Logical", "Expressive", "Detailed", "Persistent",
  "Insightful", "Sociable", "Reliable", "Decisive",
  "Systematic", "Enthusiastic", "Methodical", "Assertive",
  "Innovative", "Engaging", "Loyal", "Tenacious",
  "Perceptive", "Empathetic", "Precise", "Self-motivated",
  "Visionary", "Encouraging", "Diligent", "Goal-oriented",
  "Problem-solving", "Optimistic", "Helpful", "Closer",
];

export const ADJECTIVE_ITEMS = ADJECTIVE_TEXTS.map((text) => ({
  id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  text,
}));
