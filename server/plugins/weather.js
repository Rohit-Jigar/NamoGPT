/**
 * Real-Time Weather Plugin
 * Supports OpenWeatherMap (if WEATHER_API_KEY is configured) and
 * falls back to free Open-Meteo API (zero-key required).
 */

const WMO_CODE_MAP = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  62: 'Moderate rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

export const weatherPlugin = {
  name: 'weather',
  description: 'Real-time global weather conditions and forecast via Open-Meteo and OpenWeatherMap',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City or geographic location name (e.g. "London", "Tokyo", "New York")'
      }
    },
    required: ['location']
  },
  handler: async (args = {}) => {
    const rawLoc = typeof args === 'string' ? args : (args.location || args.city || args.query || args.q);
    if (!rawLoc || typeof rawLoc !== 'string' || !rawLoc.trim()) {
      throw new Error('Location parameter is required (e.g. location: "London").');
    }

    const cleanLocation = rawLoc.trim();
    const weatherKey = (process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY || '').trim();

    // 1. Try OpenWeatherMap if key is provided
    if (weatherKey) {
      try {
        const owmRes = await fetchOpenWeatherMap(cleanLocation, weatherKey);
        if (owmRes) return owmRes;
      } catch (err) {
        console.warn('[WeatherPlugin] OpenWeatherMap failed, falling back to Open-Meteo:', err.message);
      }
    }

    // 2. Free Open-Meteo Fallback
    return await fetchOpenMeteoWeather(cleanLocation);
  }
};

/**
 * OpenWeatherMap Fetcher
 */
async function fetchOpenWeatherMap(location, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OpenWeatherMap returned status ${res.status}`);
    }

    const data = await res.json();
    const condition = data.weather?.[0]?.description || data.weather?.[0]?.main || 'Clear';
    const temp = data.main?.temp;
    const feelsLike = data.main?.feels_like;
    const humidity = data.main?.humidity;
    const windSpeed = data.wind?.speed;
    const city = `${data.name || location}${data.sys?.country ? `, ${data.sys.country}` : ''}`;

    return {
      location: city,
      temperature: temp,
      unit: '°C',
      feelsLike,
      condition,
      humidity: `${humidity}%`,
      windSpeed: `${windSpeed} m/s`,
      source: 'OpenWeatherMap',
      summary: `Current weather in ${city}: ${temp}°C, ${condition}. Feels like ${feelsLike}°C, humidity ${humidity}%.`
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Free Open-Meteo Weather Fetcher (No API Key Required)
 */
async function fetchOpenMeteoWeather(location) {
  // Step 1: Geocode location
  const geoController = new AbortController();
  const geoTimeoutId = setTimeout(() => geoController.abort(), 6000);

  let geoData;
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'NamoGPT/1.0 WeatherPlugin' },
      signal: geoController.signal
    });
    clearTimeout(geoTimeoutId);

    if (!geoRes.ok) {
      throw new Error(`Geocoding HTTP error ${geoRes.status}`);
    }
    geoData = await geoRes.json();
  } catch (err) {
    clearTimeout(geoTimeoutId);
    throw new Error(`Failed to geocode location "${location}": ${err.message}`);
  }

  const firstMatch = geoData?.results?.[0];
  if (!firstMatch) {
    throw new Error(`Location "${location}" could not be found.`);
  }

  const { name, country, latitude, longitude, timezone } = firstMatch;
  const resolvedName = country ? `${name}, ${country}` : name;

  // Step 2: Fetch current weather forecast
  const weatherController = new AbortController();
  const weatherTimeoutId = setTimeout(() => weatherController.abort(), 6000);

  try {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relativehumidity_2m&timezone=${encodeURIComponent(timezone || 'auto')}`;
    const weatherRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': 'NamoGPT/1.0 WeatherPlugin' },
      signal: weatherController.signal
    });
    clearTimeout(weatherTimeoutId);

    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo forecast HTTP error ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();
    const current = weatherData.current_weather;
    if (!current) {
      throw new Error('Current weather data is unavailable for this location.');
    }

    const code = current.weathercode;
    const condition = WMO_CODE_MAP[code] || 'Clear';
    const temp = current.temperature;
    const windSpeed = current.windspeed;
    const isDay = current.is_day === 1;

    // Relative humidity for current hour if available
    let humidity = null;
    if (weatherData.hourly?.relativehumidity_2m?.length > 0) {
      humidity = `${weatherData.hourly.relativehumidity_2m[0]}%`;
    }

    return {
      location: resolvedName,
      coordinates: { latitude, longitude },
      temperature: temp,
      unit: '°C',
      condition,
      weatherCode: code,
      windSpeed: `${windSpeed} km/h`,
      isDay,
      humidity,
      source: 'Open-Meteo (Free)',
      summary: `Current weather in ${resolvedName}: ${temp}°C, ${condition}. Wind speed: ${windSpeed} km/h.`
    };
  } catch (err) {
    clearTimeout(weatherTimeoutId);
    throw new Error(`Failed to fetch weather for "${resolvedName}": ${err.message}`);
  }
}

export default weatherPlugin;
