# JewelHire v2 — Brand & Design Tokens (matched to jewellink.com)

Source of truth for the JewelHire v2 visual brand. Extracted live from **jewellink.com**
(2026-06-23) so JewelHire reads as a JewelLink sibling product. Supersedes the earlier
approximate LinkD/JewelLink tokens.

## Extracted from jewellink.com
- **Font:** `Inter` (body and headings). Headings are heavy — weight **800–900**, large and tight
  (hero h1 ≈ 78px / 900). Body is regular.
- **Ink / headings:** `#08122B` (very dark navy, near-black).
- **Background:** white `#ffffff` on marketing; JewelHire app uses a soft operational
  `#f4f7fb` page with white panels.
- **Primary action:** blue **gradient** `linear-gradient(135deg, #123FB9, #2F7DFF)`,
  **full pill** (`border-radius: 999px`), white text, weight **700–800**.
- **Secondary action:** white/translucent fill, **deep-blue text + border** `#123FB9`, pill.
- **Brand blues:** deep `#123FB9`, bright `#2F7DFF`.
- **Eyebrow labels:** uppercase, letter-spaced, brand blue.
- **Logo:** "Jewel" (medium) + "Link" (bold) wordmark with a blue-gradient diamond/swoosh mark.

## JewelHire token mapping
| Token | Value | Use |
|---|---|---|
| `--ink` / `head` | `#08122B` | headings, key numbers |
| `body` | `#2b3650` | body text |
| `muted` | `#64748b` | secondary text |
| `primary` | `#123FB9` | links, active nav, solid actions |
| `primary-bright` | `#2F7DFF` | gradient end, highlights |
| `primary-dark` | `#0E2E8A` | hover |
| gradient | `linear-gradient(135deg,#123FB9,#2F7DFF)` | primary buttons / brand accents |
| `page` | `#f4f7fb` | app background |
| `panel` | `#ffffff` | cards/panels |
| `line` | `#c2cfe0` | borders |
| font | `Inter` | everything |

## Component conventions
- **Primary button:** gradient pill (`.btn-grad`), Inter 700, white text.
- **Secondary button:** white pill, `#123FB9` text + 1px `#123FB9` border.
- **Operational controls** (table row actions, filters): may stay rectangular (6px) to keep
  dense screens tidy — pills are for primary/brand CTAs and marketing-style surfaces.
- **Headings:** Inter, weight 700–800, color `#08122B`, tight tracking.
- **Eyebrow/section labels:** 11–12px, uppercase, letter-spaced, `#64748b` or brand blue.

## Migration note
Changing `tailwind.config.ts` color values + the Inter font retokens the whole app at once.
Hardcoded hexes inside individual pages (e.g. `#2f6ad0`, `#eef4ff`) still read fine but should be
migrated to tokens over time. Primary buttons should adopt the gradient pill as screens are touched.
