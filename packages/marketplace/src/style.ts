/** The stylesheet of the site: light and dark, readable from phone width up. */
export const STYLE = `:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --fg: #1d2330;
  --muted: #5b6475;
  --card: #f4f6fa;
  --border: #d5dbe6;
  --accent: #2a5bd7;
  --accent-fg: #ffffff;
  --warn-bg: #fff4d6;
  --warn-fg: #4a3500;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #12151c;
    --fg: #e6e9f0;
    --muted: #9aa3b5;
    --card: #1b2029;
    --border: #2f3744;
    --accent: #7ea2ff;
    --accent-fg: #0b1020;
    --warn-bg: #3a2f10;
    --warn-fg: #f5e3b0;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.5 system-ui, sans-serif;
}
a { color: var(--accent); }
.top { padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 600; }
.top a { color: var(--fg); text-decoration: none; }
main { max-width: 760px; margin: 0 auto; padding: 16px; }
h1 { font-size: 1.6rem; margin: 0.4em 0; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.controls input, .controls select {
  font: inherit;
  padding: 8px;
  color: var(--fg);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.controls input { flex: 1 1 220px; }
.cards, .tags { list-style: none; margin: 0; padding: 0; }
.cards { display: grid; gap: 12px; }
.card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.card[hidden], #empty[hidden] { display: none; }
.card h2 { font-size: 1.1rem; margin: 0; }
.card p { margin: 4px 0; }
.icon { flex: none; border-radius: 8px; object-fit: contain; }
.creator, .generated { color: var(--muted); margin: 0; font-size: 0.9rem; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tags li { padding: 0 8px; font-size: 0.8rem; border: 1px solid var(--border); border-radius: 99px; }
.module-head { display: flex; align-items: center; gap: 16px; }
.button {
  display: inline-block;
  padding: 10px 16px;
  color: var(--accent-fg);
  background: var(--accent);
  border-radius: 6px;
  font-weight: 600;
  text-decoration: none;
}
.warning, .unavailable { padding: 12px; background: var(--warn-bg); color: var(--warn-fg); border-radius: 6px; }
.warning a { color: inherit; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
dt { color: var(--muted); }
dd { margin: 0; overflow-wrap: anywhere; }
.screenshots { display: flex; flex-wrap: wrap; gap: 8px; }
.screenshots img, .guide img { max-width: 100%; height: auto; border: 1px solid var(--border); border-radius: 6px; }
.guide { border-top: 1px solid var(--border); margin-top: 24px; overflow-wrap: anywhere; }
.guide pre { overflow-x: auto; padding: 12px; background: var(--card); border-radius: 6px; }
.guide table { display: block; overflow-x: auto; border-collapse: collapse; }
.guide th, .guide td { padding: 4px 8px; border: 1px solid var(--border); }
`;
