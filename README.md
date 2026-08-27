# Career Dashboard Site

Public deployment target for the encrypted Career Operations Dashboard generated from the private `NesmachnyDN/career-branding` repository.

This repository must contain only static UI assets and an encrypted dashboard snapshot. Never commit plaintext career data, application records, email contents, recruiter interactions, credentials, or the dashboard passphrase here.

The private source repository builds the dashboard, encrypts the snapshot with AES-256-GCM, and publishes the generated files here. GitHub Pages should be configured to deploy from the `main` branch, repository root (`/`).

Generated dashboard files are deployment artifacts and may be replaced automatically.
