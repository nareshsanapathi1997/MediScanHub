"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormBoxState } from "@/components/form-box";

type Option = { id: number; name: string };

const INDIA_ID = 101;
const DEFAULT_COUNTRY_NAME = "India";

function parseGeoId(raw?: string) {
  if (!raw?.trim()) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function load<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const json = (await response.json()) as { ok: boolean; data: T };
  if (!json.ok) throw new Error("Geo lookup failed");
  return json.data;
}

export function LocationPicker({
  required = false,
  defaultCountryId = INDIA_ID,
  saved,
}: {
  required?: boolean;
  defaultCountryId?: number;
  saved?: { countryId?: string; stateId?: string; cityId?: string; country?: string; state?: string; city?: string };
}) {
  const formState = useFormBoxState();
  const merged = { ...saved, ...formState.fields };
  const savedCountryId = parseGeoId(merged.countryId);
  const initialCountry = savedCountryId || defaultCountryId;
  const [countries, setCountries] = useState<Option[]>([]);
  const [states, setStates] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [countryId, setCountryId] = useState(initialCountry);
  const [stateId, setStateId] = useState(merged.stateId ? Number(merged.stateId) : 0);
  const [cityId, setCityId] = useState(merged.cityId ? Number(merged.cityId) : 0);
  const [cityQuery, setCityQuery] = useState(merged.city ?? "");
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    void load<Option[]>("/api/v1/geo/countries")
      .then((rows) => {
        setCountries(rows);
        setCountryId((current) => {
          if (savedCountryId && rows.some((row) => row.id === savedCountryId)) return savedCountryId;
          if (current && rows.some((row) => row.id === current)) return current;
          if (rows.some((row) => row.id === defaultCountryId)) return defaultCountryId;
          return current || defaultCountryId;
        });
      })
      .catch(() => setCountries([]));
  }, [defaultCountryId, savedCountryId]);

  useEffect(() => {
    if (savedCountryId) setCountryId(savedCountryId);
    else if (parseGeoId(merged.countryId) === 0 && merged.countryId !== undefined) {
      setCountryId(defaultCountryId);
    }
  }, [savedCountryId, merged.countryId, defaultCountryId]);

  const countryOptions = useMemo(() => {
    if (!countryId || countries.some((row) => row.id === countryId)) return countries;
    const label =
      merged.country ||
      (countryId === defaultCountryId ? DEFAULT_COUNTRY_NAME : `Country #${countryId}`);
    return [{ id: countryId, name: label }, ...countries];
  }, [countries, countryId, merged.country, defaultCountryId]);

  useEffect(() => {
    if (!countryId) return;
    setLoadingStates(true);
    void load<Option[]>(`/api/v1/geo/states?countryId=${countryId}`)
      .then((rows) => {
        setStates(rows);
        if (merged.stateId && rows.some((row) => row.id === Number(merged.stateId))) {
          setStateId(Number(merged.stateId));
        } else if (!rows.some((row) => row.id === stateId)) {
          setStateId(0);
          setCityId(0);
        }
      })
      .finally(() => setLoadingStates(false));
  }, [countryId]);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    const q = cityQuery.trim();
    const path = `/api/v1/geo/cities?stateId=${stateId}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    void load<Option[]>(path)
      .then((rows) => {
        setCities(rows);
        if (merged.cityId && rows.some((row) => row.id === Number(merged.cityId))) {
          setCityId(Number(merged.cityId));
        }
      })
      .finally(() => setLoadingCities(false));
  }, [stateId, cityQuery]);

  const effectiveCountryId = countryId > 0 ? countryId : defaultCountryId;

  const countryName = useMemo(() => {
    const fromList = countries.find((row) => row.id === effectiveCountryId)?.name;
    if (fromList) return fromList;
    if (merged.country) return merged.country;
    if (effectiveCountryId === defaultCountryId) return DEFAULT_COUNTRY_NAME;
    return "";
  }, [countries, effectiveCountryId, merged.country, defaultCountryId]);
  const stateName = useMemo(() => states.find((row) => row.id === stateId)?.name ?? merged.state ?? "", [states, stateId, merged.state]);
  const cityName = useMemo(() => cities.find((row) => row.id === cityId)?.name ?? merged.city ?? "", [cities, cityId, merged.city]);

  return (
    <div className="grid gap-3">
      <label className="field">
        Country
        <select
          disabled
          aria-readonly="true"
          aria-describedby="location-country-helper"
          className="h-10 w-full cursor-not-allowed rounded-lg border bg-muted/40 px-3 opacity-90"
          value={effectiveCountryId}
          tabIndex={-1}
        >
          {countryOptions.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
          {!countryOptions.some((row) => row.id === effectiveCountryId) ? (
            <option value={effectiveCountryId}>
              {countryName || DEFAULT_COUNTRY_NAME}
            </option>
          ) : null}
        </select>
        <p id="location-country-helper" className="mt-1 text-xs text-muted-foreground">
          Service is available in India only.
        </p>
      </label>
      <input type="hidden" name="countryId" value={effectiveCountryId} {...(required ? { required: true } : {})} />
      <input type="hidden" name="country" value={countryName || DEFAULT_COUNTRY_NAME} />
      <label className="field">
        State / province
        <select
          name="stateId"
          required={required}
          className="h-10 w-full rounded-lg border bg-background px-3"
          value={stateId || ""}
          disabled={!countryId || loadingStates}
          onChange={(event) => {
            setStateId(Number(event.target.value));
            setCityId(0);
          }}
        >
          <option value="">{loadingStates ? "Loading…" : "Select state"}</option>
          {states.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </label>
      <input type="hidden" name="state" value={stateName} />
      <label className="field">
        City
        <input
          type="search"
          className="mb-2 h-10 w-full rounded-lg border bg-background px-3"
          placeholder="Type to filter cities"
          value={cityQuery}
          onChange={(event) => setCityQuery(event.target.value)}
          disabled={!stateId}
        />
        <select
          name="cityId"
          required={required}
          className="h-10 w-full rounded-lg border bg-background px-3"
          value={cityId || ""}
          disabled={!stateId || loadingCities}
          onChange={(event) => setCityId(Number(event.target.value))}
        >
          <option value="">{loadingCities ? "Loading…" : "Select city"}</option>
          {cities.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </label>
      <input type="hidden" name="city" value={cityName} />
    </div>
  );
}
