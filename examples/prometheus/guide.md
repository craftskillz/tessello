# Local Prometheus

The state of the Prometheus that runs on your computer, at `http://localhost:9090`: its version, its targets and the alerts that are firing.

## See the state

Open **Local Prometheus** from the Launcher. It shows how many targets are up, each target with its job and instance, and the alerts that are firing. Click **Retry** to ask Prometheus again.

## On the Home

The Widget shows how many targets are up, and how many alerts are firing. Click it to open Local Prometheus.

## Your local network

Local Prometheus asks for access to your computer at `localhost:9090`, and nothing else. Tessello shows this access in red before you install it.

The first time it asks Prometheus, from its View or from its Widget on the Home, your browser may ask whether Tessello may reach devices on your local network, or apps on this device. Allow it: otherwise your browser blocks every Module that uses your local network.

## When Prometheus can't be reached

Local Prometheus tells you what to check:

- **Prometheus can't be reached**: check that Prometheus runs and answers at `http://localhost:9090`. Prometheus accepts requests from other sites by default; if it was started with `--web.cors.origin`, that option must accept every site: `--web.cors.origin='.*'`.
- **Your browser blocks access to your computer**: you refused the browser's question. Open the site settings of Tessello (the icon left of the address), allow access to the local network, then click **Retry**.

## Your data

Local Prometheus saves nothing: it asks Prometheus each time you open it.
