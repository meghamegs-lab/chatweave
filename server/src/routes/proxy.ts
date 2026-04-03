import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

// Node 18+ provides global fetch; declare it for TypeScript when @types/node is absent.
declare function fetch(input: string, init?: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

const router = Router();

// GET /api/proxy/weather?city=London
router.get('/weather', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const city = req.query.city as string;
    if (!city) {
      throw new AppError('City parameter is required', 400, 'MISSING_CITY');
    }

    // If no API key configured, return mock data
    const apiKey = (config as any).openweatherApiKey || process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      // Return mock weather data when no API key is available
      const seed = city.length * 7;
      const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Drizzle'];
      res.json({
        city,
        temp: 15 + (seed % 25),
        feels_like: 13 + (seed % 25),
        temp_min: 10 + (seed % 20),
        temp_max: 20 + (seed % 25),
        humidity: 40 + (seed % 40),
        wind_speed: 5 + (seed % 20),
        conditions: conditions[seed % conditions.length],
        description: conditions[seed % conditions.length].toLowerCase(),
        icon: '01d',
      });
      return;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new AppError(`City "${city}" not found`, 404, 'CITY_NOT_FOUND');
      }
      throw new AppError('Weather API error', 502, 'WEATHER_API_ERROR');
    }

    const data = await response.json();

    res.json({
      city: data.name,
      temp: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      temp_min: Math.round(data.main.temp_min),
      temp_max: Math.round(data.main.temp_max),
      humidity: data.main.humidity,
      wind_speed: Math.round(data.wind.speed * 3.6), // m/s to km/h
      conditions: data.weather[0].main,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/proxy/forecast?city=London
router.get('/forecast', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const city = req.query.city as string;
    if (!city) {
      throw new AppError('City parameter is required', 400, 'MISSING_CITY');
    }

    const apiKey = (config as any).openweatherApiKey || process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      // Return mock forecast data
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const conditions = ['Clear', 'Clouds', 'Rain', 'Clear', 'Clouds'];
      const seed = city.length * 13;
      res.json({
        city,
        forecast: days.map((day, i) => ({
          day,
          high: 18 + ((seed + i * 3) % 15),
          low: 8 + ((seed + i * 2) % 10),
          conditions: conditions[i],
          icon: '01d',
        })),
      });
      return;
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new AppError('Weather API error', 502, 'WEATHER_API_ERROR');
    }

    const data = await response.json();

    // Group by day and get daily highs/lows
    const dailyMap = new Map<string, { temps: number[]; conditions: string; icon: string }>();
    for (const item of data.list) {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toLocaleDateString('en-US', { weekday: 'short' });
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { temps: [], conditions: item.weather[0].main, icon: item.weather[0].icon });
      }
      dailyMap.get(dayKey)!.temps.push(item.main.temp);
    }

    const forecast = Array.from(dailyMap.entries()).slice(0, 5).map(([day, info]) => ({
      day,
      high: Math.round(Math.max(...info.temps)),
      low: Math.round(Math.min(...info.temps)),
      conditions: info.conditions,
      icon: info.icon,
    }));

    res.json({ city: data.city.name, forecast });
  } catch (err) {
    next(err);
  }
});

export { router as proxyRouter };
