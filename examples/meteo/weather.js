// What the View and the Widget share: the cities a User can follow, and the current weather of one of them, from
// Open-Meteo (https://open-meteo.com), a public API that accepts requests from any origin and needs no key. Its
// origin is the only one declared in the Manifest's Permissions: the Host limits the Module to it.

export const CITIES = [
  { id: "paris", name: "Paris", latitude: 48.8566, longitude: 2.3522 },
  { id: "london", name: "London", latitude: 51.5072, longitude: -0.1276 },
  { id: "new-york", name: "New York", latitude: 40.7128, longitude: -74.006 },
  { id: "tokyo", name: "Tokyo", latitude: 35.6762, longitude: 139.6503 },
  { id: "casablanca", name: "Casablanca", latitude: 33.5731, longitude: -7.5898 },
  { id: "sydney", name: "Sydney", latitude: -33.8688, longitude: 151.2093 },
  { id: "montreal", name: "Montréal", latitude: 45.5019, longitude: -73.5674 },
  { id: "berlin", name: "Berlin", latitude: 52.52, longitude: 13.405 },
];

/** The cities shown until the User chooses their own, kept in the Host storage under the key "cities". */
export const DEFAULT_CITIES = ["paris", "new-york", "tokyo"];

export const cityById = (id) => CITIES.find((city) => city.id === id);

/** The cities the User follows, as stored by the View. */
export async function followedCities(host) {
  const ids = (await host.storage.get("cities")) ?? DEFAULT_CITIES;
  return ids.map(cityById).filter(Boolean);
}

// WMO weather interpretation codes, as Open-Meteo gives them.
const CONDITIONS = [
  [[0], "Clear sky", "☀️"],
  [[1, 2], "Partly cloudy", "⛅"],
  [[3], "Overcast", "☁️"],
  [[45, 48], "Fog", "🌫️"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦️"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Rain", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Snow", "🌨️"],
  [[95, 96, 99], "Thunderstorm", "⛈️"],
];

export function condition(code) {
  const [, label, symbol] = CONDITIONS.find(([codes]) => codes.includes(code)) ?? [[], "Unknown", "·"];
  return { label, symbol };
}

/** The current weather of a city, and today's lowest and highest temperatures, in °C and km/h. */
export async function currentWeather(city) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    current: "temperature_2m,weather_code,wind_speed_10m",
    daily: "temperature_2m_min,temperature_2m_max",
    forecast_days: "1",
    timezone: "auto",
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo answered ${response.status}.`);
  const { current, daily } = await response.json();
  return {
    temperature: Math.round(current.temperature_2m),
    wind: Math.round(current.wind_speed_10m),
    min: Math.round(daily.temperature_2m_min[0]),
    max: Math.round(daily.temperature_2m_max[0]),
    ...condition(current.weather_code),
  };
}

export function applyTheme(theme) {
  const names = { background: "--background", surface: "--surface", text: "--text", textMuted: "--text-muted", accent: "--accent", border: "--border" };
  for (const [color, variable] of Object.entries(names)) document.documentElement.style.setProperty(variable, theme.colors[color]);
  document.documentElement.style.colorScheme = theme.mode;
}
