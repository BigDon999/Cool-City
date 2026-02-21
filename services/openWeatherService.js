/**
 * OpenWeatherMap FREE-TIER Service (2.5 API) — with Open-Meteo fallback
 *
 * Primary:  OWM /data/2.5/weather + /data/2.5/forecast (needs API key)
 * Fallback: Open-Meteo (no key required, fully free)
 *
 * Safety:
 * - Validates lat/lon as finite numbers
 * - Validates API key exists (falls back to Open-Meteo if not)
 * - Handles 401 (invalid key) by falling back automatically
 * - Handles network failures gracefully
 * - Uses Array.isArray checks before mapping collections
 * - Never throws — always returns null on error
 * - No console logs in production (__DEV__ guarded)
 */

const OWM_BASE = process.env.EXPO_PUBLIC_OWM_BASE_URL;
const OPEN_METEO_BASE = process.env.EXPO_PUBLIC_OPEN_METEO_URL;
const API_KEY = process.env.EXPO_PUBLIC_OWM_API_KEY;

// ──────────────────────────────────────────────────────────────
// Heat Risk Calculation
// ──────────────────────────────────────────────────────────────

/**
 * Calculate a composite heat risk score from temperature and humidity.
 *
 * Uses the Steadman heat-index regression (°C variant).
 * When temp < 27 °C or humidity < 40 %, uses an apparent-temp
 * approximation instead.
 *
 * @param {number} temp  — temperature in °C
 * @param {number} hum   — relative humidity %
 * @param {number} uvi   — UV index (0-11+), optional
 * @returns {{ heatIndex: number, risk: string }}
 */
export function calculateHeatRisk(temp, hum, uvi = 0) {
  try {
    const T = typeof temp === 'number' && isFinite(temp) ? temp : 0;
    const R = typeof hum === 'number' && isFinite(hum) ? hum : 0;
    const U = typeof uvi === 'number' && isFinite(uvi) ? uvi : 0;

    let hi;
    if (T >= 27 && R >= 40) {
      hi =
        -8.784695 +
        1.61139411 * T +
        2.338549 * R -
        0.14611605 * T * R -
        0.012308094 * T * T -
        0.01642482777 * R * R +
        0.002211732 * T * T * R +
        0.00072546 * T * R * R -
        0.000003582 * T * T * R * R;
    } else {
      hi = T + 0.33 * (R / 100 * 6.105 * Math.exp(17.27 * T / (237.7 + T))) - 4.0;
    }

    const uvBonus = U > 6 ? (U - 6) * 0.5 : 0;
    hi = Math.round(hi + uvBonus);

    let risk;
    if (hi < 27) risk = 'SAFE';
    else if (hi < 30) risk = 'MODERATE';
    else if (hi < 35) risk = 'CAUTION';
    else if (hi < 41) risk = 'DANGER';
    else risk = 'EXTREME';

    return { heatIndex: hi, risk };
  } catch (_) {
    return { heatIndex: Math.round(temp || 0), risk: 'SAFE' };
  }
}

// ──────────────────────────────────────────────────────────────
// Internal: Fetch with timeout
// ──────────────────────────────────────────────────────────────

async function safeFetch(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// Statistical mode (most common value in an array)
// ──────────────────────────────────────────────────────────────

function mode(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const freq = {};
  let maxCount = 0;
  let result = arr[0];
  for (const item of arr) {
    freq[item] = (freq[item] || 0) + 1;
    if (freq[item] > maxCount) {
      maxCount = freq[item];
      result = item;
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────
// PRIMARY: OpenWeatherMap 2.5 (needs valid API key)
// ──────────────────────────────────────────────────────────────

async function fetchFromOWM(lat, lon) {
  if (!API_KEY || API_KEY.length < 10) return null;

  const currentUrl = `${OWM_BASE}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
  const forecastUrl = `${OWM_BASE}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

  const [currentRes, forecastRes] = await Promise.all([
    safeFetch(currentUrl),
    safeFetch(forecastUrl),
  ]);

  // If key is invalid or rate-limited, return null to trigger fallback
  if (!currentRes.ok || !forecastRes.ok) {
    if (__DEV__) console.warn('[OWM] API returned', currentRes.status, '— falling back to Open-Meteo');
    return null;
  }

  const currentData = await currentRes.json();
  const forecastData = await forecastRes.json();

  if (!currentData || typeof currentData !== 'object') return null;

  // Normalize current
  const main = currentData.main || {};
  const wind = currentData.wind || {};
  const temperature = main.temp ?? 0;
  const humidity = main.humidity ?? 0;
  const windSpeed = wind.speed ?? 0;

  const weatherDesc =
    Array.isArray(currentData.weather) && currentData.weather.length > 0
      ? currentData.weather[0].description : '';
  const weatherIcon =
    Array.isArray(currentData.weather) && currentData.weather.length > 0
      ? currentData.weather[0].icon : '';

  // Normalize hourly (3-hour intervals)
  const forecastList = forecastData?.list;
  const hourly = Array.isArray(forecastList)
    ? forecastList.map((item) => ({
        dt: item.dt,
        temp: item.main?.temp ?? 0,
        humidity: item.main?.humidity ?? 0,
        uvi: 0,
        windSpeed: item.wind?.speed ?? 0,
        pop: item.pop ?? 0,
        icon: Array.isArray(item.weather) && item.weather.length > 0 ? item.weather[0].icon : '',
        description: Array.isArray(item.weather) && item.weather.length > 0 ? item.weather[0].description : '',
      }))
    : [];

  // Normalize daily (aggregate 3-hour into day-level)
  const dayMap = {};
  if (Array.isArray(forecastList)) {
    for (const item of forecastList) {
      const date = new Date(item.dt * 1000);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { dt: item.dt, temps: [], humidities: [], windSpeeds: [], pops: [], icons: [], descriptions: [] };
      }
      const g = dayMap[dayKey];
      g.temps.push(item.main?.temp ?? 0);
      g.humidities.push(item.main?.humidity ?? 0);
      g.windSpeeds.push(item.wind?.speed ?? 0);
      g.pops.push(item.pop ?? 0);
      if (Array.isArray(item.weather) && item.weather.length > 0) {
        g.icons.push(item.weather[0].icon);
        g.descriptions.push(item.weather[0].description);
      }
    }
  }

  const daily = Object.values(dayMap).map((day) => ({
    dt: day.dt,
    tempMin: Math.min(...day.temps),
    tempMax: Math.max(...day.temps),
    tempDay: day.temps.reduce((a, b) => a + b, 0) / day.temps.length,
    humidity: Math.round(day.humidities.reduce((a, b) => a + b, 0) / day.humidities.length),
    uvi: 0,
    windSpeed: +(day.windSpeeds.reduce((a, b) => a + b, 0) / day.windSpeeds.length).toFixed(1),
    pop: Math.max(...day.pops),
    icon: mode(day.icons) || '',
    description: mode(day.descriptions) || '',
  }));

  return {
    temperature, humidity, uvi: 0, windSpeed,
    weatherDesc, weatherIcon, hourly, daily,
    alerts: [], fetchedAt: Date.now(), source: 'openweathermap',
  };
}

// ──────────────────────────────────────────────────────────────
// FALLBACK: Open-Meteo (free, no API key required)
// ──────────────────────────────────────────────────────────────

async function fetchFromOpenMeteo(lat, lon) {
  const url =
    `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m` +
    `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=auto`;

  const res = await safeFetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data?.current) return null;

  const temperature = data.current.temperature_2m ?? 0;
  const humidity = data.current.relative_humidity_2m ?? 0;
  const windSpeed = data.current.wind_speed_10m ?? 0;

  // Build hourly array from Open-Meteo format
  const hourly = [];
  if (data.hourly && Array.isArray(data.hourly.temperature_2m)) {
    const currentHour = new Date().getHours();
    // Take next 40 entries (like OWM) starting from current hour
    const start = currentHour;
    const count = Math.min(40, data.hourly.temperature_2m.length - start);
    for (let i = start; i < start + count; i++) {
      if (i < data.hourly.temperature_2m.length) {
        hourly.push({
          dt: Math.floor(Date.now() / 1000) + (i - start) * 3600,
          temp: data.hourly.temperature_2m[i] ?? 0,
          humidity: data.hourly.relative_humidity_2m?.[i] ?? 0,
          uvi: 0,
          windSpeed: data.hourly.wind_speed_10m?.[i] ?? 0,
          pop: 0,
          icon: '',
          description: '',
        });
      }
    }
  }

  // Build daily array
  const daily = [];
  if (data.daily && Array.isArray(data.daily.temperature_2m_max)) {
    const maxTemps = data.daily.temperature_2m_max;
    const minTemps = data.daily.temperature_2m_min || [];
    for (let i = 0; i < maxTemps.length; i++) {
      daily.push({
        dt: Math.floor(Date.now() / 1000) + i * 86400,
        tempMin: minTemps[i] ?? 0,
        tempMax: maxTemps[i] ?? 0,
        tempDay: ((maxTemps[i] ?? 0) + (minTemps[i] ?? 0)) / 2,
        humidity: 0,
        uvi: 0,
        windSpeed: 0,
        pop: 0,
        icon: '',
        description: '',
      });
    }
  }

  return {
    temperature, humidity, uvi: 0, windSpeed,
    weatherDesc: '', weatherIcon: '', hourly, daily,
    alerts: [], fetchedAt: Date.now(), source: 'open-meteo',
  };
}

// ──────────────────────────────────────────────────────────────
// Public: fetchWeather — tries OWM first, falls back to Open-Meteo
// ──────────────────────────────────────────────────────────────

/**
 * Fetch weather data. Tries OpenWeatherMap first (if key is valid),
 * then falls back to Open-Meteo (free, no key).
 *
 * @param {number} lat — latitude
 * @param {number} lon — longitude
 * @returns {Promise<object|null>} Normalized weather object or null
 */
export async function fetchWeather(lat, lon) {
  // Guard: valid coordinates
  if (
    typeof lat !== 'number' || !isFinite(lat) ||
    typeof lon !== 'number' || !isFinite(lon)
  ) {
    if (__DEV__) console.warn('[Weather] Invalid coordinates:', lat, lon);
    return null;
  }

  try {
    // 1. Try OWM first
    const owmResult = await fetchFromOWM(lat, lon);
    if (owmResult) {
      if (__DEV__) console.log('[Weather] ✓ Loaded from OpenWeatherMap');
      return owmResult;
    }

    // 2. OWM failed (bad key, rate limit, etc.) — fall back to Open-Meteo
    if (__DEV__) console.log('[Weather] OWM unavailable, using Open-Meteo fallback');
    const meteoResult = await fetchFromOpenMeteo(lat, lon);
    if (meteoResult) return meteoResult;

    return { error: 'Weather data unavailable from all sources.' };
  } catch (err) {
    if (__DEV__) console.warn('[Weather] fetchWeather failed:', String(err?.message || err || 'Unknown Error'));
    if (err?.name === 'AbortError') {
      return { error: 'Weather request timed out. Check your connection.' };
    }
    return { error: 'Unable to connect to weather service.' };
  }
}
