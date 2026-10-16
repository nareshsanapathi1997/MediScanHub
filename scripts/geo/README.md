# Geo master data

Source: [dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database) (JSON). `cities.json` is fetched from the latest GitHub Release (gzip); countries/states still come from the repo.

```bash
npm run geo:fetch    # download countries.json, states.json, cities.json (~100MB+)
npm run geo:import   # load into GeoCountry, GeoState, GeoCity (uses .env)
```

Run once per database (`mediscan_hub` and `mediscan_test` if you use tests with geo lookups).
