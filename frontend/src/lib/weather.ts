// ── Weather Types ─────────────────────────────────────────────────────

export type WeatherLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

export type WeatherCurrent = {
  temperature: number; // °F
  condition: string;
  emoji: string;
  weatherCode: number;
};

export type WeatherForecastDay = {
  date: string; // YYYY-MM-DD
  tempHigh: number; // °F
  tempLow: number; // °F
  condition: string;
  emoji: string;
  weatherCode: number;
  precipChance: number; // 0–100
  sunrise: string; // HH:MM
  sunset: string; // HH:MM
};

export type WeatherData = {
  location: WeatherLocation;
  current: WeatherCurrent;
  forecast: WeatherForecastDay[]; // today + 2 more days
  fetchedAt: string; // ISO timestamp
};

// ── WMO Weather Code Mapping ──────────────────────────────────────────

const WMO_CONDITIONS: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  56: "Freezing Drizzle",
  57: "Heavy Freezing Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Heavy Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Light Showers",
  81: "Showers",
  82: "Heavy Showers",
  85: "Light Snow Showers",
  86: "Heavy Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm + Hail",
  99: "Thunderstorm + Heavy Hail",
};

const WMO_EMOJIS: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌧️",
  55: "🌧️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "🌨️",
  73: "❄️",
  75: "❄️",
  77: "❄️",
  80: "🌦️",
  81: "🌧️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

export function wmoCodeToCondition(code: number): string {
  return WMO_CONDITIONS[code] ?? "Unknown";
}

export function wmoCodeToEmoji(code: number): string {
  return WMO_EMOJIS[code] ?? "🌡️";
}

// ── Normalizer ────────────────────────────────────────────────────────

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

export function normalizeWeatherData(
  raw: OpenMeteoResponse,
  location: WeatherLocation
): WeatherData {
  const currentCode = raw.current?.weather_code ?? 0;
  const current: WeatherCurrent = {
    temperature: Math.round(raw.current?.temperature_2m ?? 0),
    condition: wmoCodeToCondition(currentCode),
    emoji: wmoCodeToEmoji(currentCode),
    weatherCode: currentCode,
  };

  const forecast: WeatherForecastDay[] = [];
  const daily = raw.daily;
  if (daily?.time) {
    for (let i = 0; i < Math.min(daily.time.length, 3); i++) {
      const code = daily.weather_code?.[i] ?? 0;
      const sunriseRaw = daily.sunrise?.[i] ?? "";
      const sunsetRaw = daily.sunset?.[i] ?? "";
      forecast.push({
        date: daily.time[i],
        tempHigh: Math.round(daily.temperature_2m_max?.[i] ?? 0),
        tempLow: Math.round(daily.temperature_2m_min?.[i] ?? 0),
        condition: wmoCodeToCondition(code),
        emoji: wmoCodeToEmoji(code),
        weatherCode: code,
        precipChance: daily.precipitation_probability_max?.[i] ?? 0,
        sunrise: sunriseRaw.includes("T") ? sunriseRaw.split("T")[1].slice(0, 5) : "",
        sunset: sunsetRaw.includes("T") ? sunsetRaw.split("T")[1].slice(0, 5) : "",
      });
    }
  }

  return {
    location,
    current,
    forecast,
    fetchedAt: new Date().toISOString(),
  };
}
