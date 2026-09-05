# Security policy

Cognitive Biases is primarily a static public website and public knowledge dataset. The repository also contains a local, read-only MCP reference adapter.

## Supported surface

Security reports are relevant when they affect the current `main` branch, the deployed GitHub Pages site, the build/deploy workflow, published data integrity, or the reference MCP adapter.

## Reporting

Do not publish secrets, credentials, private user data, or an exploitable proof-of-concept in a public issue.

For a potentially sensitive vulnerability, contact the maintainer at `metalhatscats@gmail.com` with:

- the affected component or URL;
- a concise description of the issue and impact;
- reproduction steps that do not expose third-party data;
- any suggested mitigation, if known.

For non-sensitive correctness, evidence, provenance, or data-quality problems, use the repository issue templates instead. Those are handled through the public correction and editorial workflow rather than as security incidents.

## Boundaries

The public website is educational and does not accept user accounts or server-side form submissions. Interactive decision tools are designed to keep drafts in the browser unless a page explicitly states otherwise.

The MCP adapter is intended to be read-only over published project data. A security report should distinguish a vulnerability in the adapter from an incorrect or disputed knowledge claim in the underlying dataset.

Security metadata and repository practices are not a guarantee that the software is vulnerability-free.
