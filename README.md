# NUSHOPA API

Run the backend checks with `npm run validate`. The unit tests cover the
health and not-found routes; the production smoke test runs the health check
with `NODE_ENV=production`. These checks are also run by the backend CI
workflow and do not require a live database.
