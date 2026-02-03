## Prerequisites
- The latest lts version of node is prefered. Older version may cause issues with packages.
- yarn

## Getting Started
run `yarn install`
run `node server.js`
in a new terminal tab run `yarn start`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_DEBUG` | Set to `true` to enable rate limiter logging. Shows queue position and wait times for Scryfall API requests. | `false` |

Example:
```bash
RATE_LIMIT_DEBUG=true node server.js
```

## External APIs
This project utilizes the Scryfall API via the Scryfall SDK found [here](https://github.com/ChiriVulpes/scryfall-sdk).

The application implements rate limiting (100ms delay between requests) to comply with [Scryfall's rate limit policy](https://scryfall.com/docs/api).
