# Mermaid figure source and rendering

This report uses eight authored Mermaid diagrams (source: `figures/NN-*.mmd`),
pre-rendered as local `figures/NN-*.svg` assets. The editorial page loads SVGs
as ordinary images, and links the editable Mermaid source below every diagram.
No Mermaid runtime, JavaScript import, public CDN, or external font is required
for reading the deployed report. The same files are copied into the GitHub
Pages release and hashed in the V13.5 asset manifest.

## Update process

1. Edit the corresponding `.mmd` source.
2. Run `mmdc` (Mermaid CLI 11.4.x is used here) in this `figures/` folder:

   ```sh
   for source in [0-9][0-9]-*.mmd; do
     mmdc -i "$source" -o "${source%.mmd}.svg" \
       -c mermaid-config.json -p puppeteer-config.json -b transparent
   done
   ```

3. If the browser is not at `/usr/bin/chromium`, adjust the local Puppeteer
   launcher configuration for the environment. The Mermaid sources and theme
   do not depend on that path.
4. Review desktop and mobile figure rendering; verify no cropped labels or
   unresolvable links. Figure containers scroll horizontally on narrow screens.
5. Run `npm test` and `npm run release:check` in the V13.5 root. The Pages
   workflow consumes the pinned V13.5 revision, assembles and verifies all
   declared report assets, and only then publishes.

## Editorial purpose of each figure

| Figure | What it must show |
|---|---|
| 01 | Progression from provisioning through TLS acceptance to usable messaging |
| 02 | Which client talks to which service over HTTPS, MQTT/TLS and direct TCP, and why |
| 03 | Fresh-onboarding messages in temporal order; distinct from already-paired reconnect |
| 04 | Endpoint choice, TLS identity and application acceptance as independent checks |
| 05 | Routing, TLS, bootstrap, authorization, persistence as five necessary gates |
| 06 | CA signing ability is not identical to client certificate acceptance |
| 07 | Different accepted TLS hostname identities, same remaining protocol obligations |
| 08 | Why a successful TLS impersonation need not produce durable local configuration |

These diagrams explain conditional trust mechanisms, not a demonstrated
Roborock-specific CA-impersonation exploit. The explicit assumption for figure
07 and the comparative matrix is that the affected CA-signed certificate is
accepted by the target TLS client; other gates still need separate verification.
