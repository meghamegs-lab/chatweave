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

// GET /api/proxy/trivia?category=science&difficulty=easy
// Demonstrates API-key proxy pattern — key stored server-side, never exposed to client
router.get('/trivia', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string || 'science';
    const difficulty = req.query.difficulty as string || 'easy';

    // In production, this would use a real API key stored in env vars:
    // const apiKey = process.env.TRIVIA_API_KEY;
    // const url = `https://api.example.com/trivia?key=${apiKey}&category=${category}&difficulty=${difficulty}`;
    // The key is NEVER sent to the plugin — only the server sees it.

    // For demo: return curated science questions
    const questions: Record<string, any[]> = {
      easy: [
        { question: 'What planet is known as the Red Planet?', answer: 'Mars', options: ['Mars', 'Venus', 'Jupiter', 'Saturn'] },
        { question: 'What gas do plants absorb from the atmosphere?', answer: 'Carbon dioxide', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'] },
        { question: 'How many legs does an insect have?', answer: '6', options: ['4', '6', '8', '10'] },
      ],
      medium: [
        { question: 'What is the chemical symbol for gold?', answer: 'Au', options: ['Au', 'Ag', 'Fe', 'Go'] },
        { question: 'What is the speed of light in km/s (approximately)?', answer: '300,000', options: ['150,000', '300,000', '500,000', '1,000,000'] },
        { question: 'What organelle is the powerhouse of the cell?', answer: 'Mitochondria', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'] },
      ],
      hard: [
        { question: 'What is the half-life of Carbon-14?', answer: '5,730 years', options: ['1,200 years', '5,730 years', '10,000 years', '50,000 years'] },
        { question: 'What is the Chandrasekhar limit?', answer: '1.4 solar masses', options: ['0.5 solar masses', '1.4 solar masses', '3.0 solar masses', '10 solar masses'] },
        { question: "What is the SI unit of electrical resistance?", answer: 'Ohm', options: ['Volt', 'Ampere', 'Ohm', 'Watt'] },
      ],
    };

    const pool = questions[difficulty] || questions['easy'];

    res.json({
      category,
      difficulty,
      questions: pool,
      source: 'server-proxied',
      note: 'API key stored server-side, never exposed to client plugin',
    });
  } catch (err) {
    next(err);
  }
});

export { router as proxyRouter };
