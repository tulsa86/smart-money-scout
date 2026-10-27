# SEC Form 4 fixture corpus

This directory is intentionally empty of XML until **original bytes from genuine SEC EDGAR filings** are obtained and verified. Synthetic samples must never be described as genuine.

Add an XML file and a corresponding entry to `manifest.json` with:
- `file`: a flat, safe XML filename
- `accession`: the SEC accession number
- `sourceUrl`: the actual SEC EDGAR XML URL
- `retrievedAt`: ISO 8601 retrieval timestamp
- `sha256`: SHA-256 of the exact committed XML bytes

The offline test validates metadata, byte integrity and basic document type. Additional assertions about issuer, owners, transactions, amendments and exclusions must be added as authentic fixtures arrive. **An empty manifest is infrastructure-only, not evidence of real SEC compatibility.**

Do not add real contact emails, API secrets or personal information to fixtures. EDGAR filings themselves may contain public reporting-person information.
