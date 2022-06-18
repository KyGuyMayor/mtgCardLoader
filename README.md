## Prerequisites
- The latest lts version of node is prefered. Older version may cause issues with packages.
- yarn

## Getting Started
run `yarn install`
run `node server/server.js`
in a new terminal tab run `yarn start`.

## External APIs
This project utilizes the Scrfall API via the Scryfall sdk found [here](https://github.com/ChiriVulpes/scryfall-sdk)

## MySQL Database
In order to run this application locally, a MySQL database is requried.
Additionally a file named database.json is required to be added.
Example content:

```
{
  "dev": {
    "driver": "mysql",
    "host": "localhost",
    "port": "3306",
    "user": "root",
    "password": "example",
    "database": "mtg_collection_tracker"
  }
}
```