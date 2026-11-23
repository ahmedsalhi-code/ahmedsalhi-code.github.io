# mrxfuji.me

Personal portfolio of **Ahmed Salhi (MrXFuji)**: embedded systems, firmware security, reverse engineering.

Static site with no build step and no dependencies: `index.html`, `assets/style.css`, `assets/main.js`.
Served by GitHub Pages at the custom domain in `CNAME`.

Run locally:

```bash
python -m http.server 8000
# open http://localhost:8000
```

Features: animated oscilloscope hero (an I2C trace whose SDA line spells `MRXFUJI` in ASCII), boot log, an interactive serial terminal (`help`), a skills "register map", filterable project cards with expandable notes, a crackme lab, a Ctrl+K command palette, and a motion toggle that respects `prefers-reduced-motion`. No cookies and no trackers.
