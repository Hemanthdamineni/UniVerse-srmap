# ERP Manual Artifact Refresh Runbook

This workflow is manual because ERP discovery requires captcha/login interaction.

1. Export credentials if you want auto-fill during login:
`export ERP_USERNAME="your_id"`
`export ERP_PASSWORD="your_password"`
2. Run the full refresh pipeline:
`npm run refresh:artifacts:manual`
3. If you only want static CI-safe verification:
`npm run verify:integrity`

The manual script runs:
1. `discover:endpoints`
2. `fetch:endpoints`
3. `preprocess:endpoints`
4. `analyze:ui-map`
5. `verify:integrity`
