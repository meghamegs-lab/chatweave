import { useState, useEffect, useCallback } from 'react';

let messageCounter = 0;
function genMsgId() { return `msg_${Date.now()}_${++messageCounter}`; }
function sendToParent(msg: any) { window.parent !== window && window.parent.postMessage(msg, '*'); }

// Weather emoji icons
const weatherIcons: Record<string, string> = {
  sunny: '\u2600\uFE0F', cloudy: '\u2601\uFE0F', rainy: '\uD83C\uDF27\uFE0F', snowy: '\u2744\uFE0F', stormy: '\u26C8\uFE0F',
  partly_cloudy: '\u26C5', foggy: '\uD83C\uDF2B\uFE0F', windy: '\uD83D\uDCA8',
};

const conditions = ['sunny', 'cloudy', 'partly_cloudy', 'rainy', 'foggy'];

function mockWeather(city: string) {
  const seed = city.length * 7;
  const temp = 15 + (seed % 25);
  const cond = conditions[seed % conditions.length];
  return {
    city, temp, feels_like: temp - 2, conditions: cond,
    humidity: 40 + (seed % 40), wind_speed: 5 + (seed % 20),
    wind_direction: ['N','NE','E','SE','S','SW','W','NW'][seed % 8],
    icon: weatherIcons[cond] || '\uD83C\uDF24\uFE0F',
    description: `Current weather in ${city}: ${cond.replace('_', ' ')}, ${temp}\u00B0C`,
  };
}

function mockForecast(city: string) {
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  const seed = city.length * 13;
  return days.map((day, i) => ({
    day, high: 18 + ((seed + i * 3) % 15), low: 8 + ((seed + i * 2) % 10),
    conditions: conditions[(seed + i) % conditions.length],
    icon: weatherIcons[conditions[(seed + i) % conditions.length]] || '\uD83C\uDF24\uFE0F',
  }));
}

interface WeatherData { city: string; temp: number; feels_like: number; conditions: string; humidity: number; wind_speed: number; wind_direction: string; icon: string; description: string; }
interface ForecastDay { day: string; high: number; low: number; conditions: string; icon: string; }

export default function App() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [error, setError] = useState<string | null>(null);

  const handleTool = useCallback((messageId: string, toolName: string, params: any) => {
    switch (toolName) {
      case 'get_weather': {
        const city = params.city;
        if (!city) {
          sendToParent({ type: 'TOOL_RESULT', messageId, payload: { result: null, error: 'City is required' } });
          return;
        }
        const data = mockWeather(city);
        setWeather(data);
        sendToParent({ type: 'TOOL_RESULT', messageId, payload: { result: data } });
        sendToParent({ type: 'STATE_UPDATE', messageId: genMsgId(), payload: { state: { city, weather: data }, summary: `Weather for ${city}: ${data.temp}\u00B0C, ${data.conditions}` } });
        // Auto-complete after showing
        setTimeout(() => {
          sendToParent({ type: 'PLUGIN_COMPLETE', messageId: genMsgId(), payload: { event: 'weather_displayed', data: { city, temperature: data.temp, conditions: data.conditions }, summary: `Weather displayed for ${city}: ${data.temp}\u00B0C, ${data.conditions.replace('_',' ')}` } });
        }, 1000);
        break;
      }
      case 'get_forecast': {
        const city = params.city;
        if (!city) {
          sendToParent({ type: 'TOOL_RESULT', messageId, payload: { result: null, error: 'City is required' } });
          return;
        }
        const data = mockForecast(city);
        setForecast(data);
        if (!weather) {
          const w = mockWeather(city);
          setWeather(w);
        }
        sendToParent({ type: 'TOOL_RESULT', messageId, payload: { result: { city, forecast: data } } });
        break;
      }
      default:
        sendToParent({ type: 'TOOL_RESULT', messageId, payload: { result: null, error: `Unknown tool: ${toolName}` } });
    }
  }, [weather]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data?.type) return;
      switch (data.type) {
        case 'PLUGIN_INIT': setTheme(data.payload?.theme || 'light'); document.body.className = data.payload?.theme || 'light'; break;
        case 'TOOL_INVOKE': handleTool(data.messageId, data.payload.toolName, data.payload.parameters); break;
        case 'THEME_UPDATE': setTheme(data.payload?.theme || 'light'); document.body.className = data.payload?.theme || 'light'; break;
      }
    };
    window.addEventListener('message', handler);
    sendToParent({ type: 'PLUGIN_READY', messageId: genMsgId(), payload: { version: '1.0.0' } });
    return () => window.removeEventListener('message', handler);
  }, [handleTool]);

  const isDark = theme === 'dark';
  const cardBg = isDark ? '#2a2a4a' : '#fff';
  const borderColor = isDark ? '#3a3a5a' : '#e0e0e0';

  if (!weather) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#aaa' : '#888' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>{'\uD83C\uDF24\uFE0F'}</div>
        <p style={{ fontSize: '15px' }}>Waiting for weather request...</p>
        <p style={{ fontSize: '13px', marginTop: '4px', opacity: 0.7 }}>Ask: "What's the weather in London?"</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
      {/* Current Weather Card */}
      <div style={{ background: cardBg, borderRadius: '12px', padding: '20px', border: `1px solid ${borderColor}`, marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', margin: 0 }}>{weather.city}</h2>
            <p style={{ fontSize: '13px', color: isDark ? '#aaa' : '#888', margin: '2px 0' }}>{weather.conditions.replace('_', ' ')}</p>
          </div>
          <div style={{ fontSize: '48px' }}>{weather.icon}</div>
        </div>
        <div style={{ fontSize: '42px', fontWeight: 700, margin: '8px 0' }}>{weather.temp}{'\u00B0'}C</div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: isDark ? '#aaa' : '#666' }}>
          <span>Feels like {weather.feels_like}{'\u00B0'}C</span>
          <span>{'\uD83D\uDCA7'} {weather.humidity}%</span>
          <span>{'\uD83D\uDCA8'} {weather.wind_speed} km/h {weather.wind_direction}</span>
        </div>
      </div>

      {/* Forecast */}
      {forecast && (
        <div style={{ background: cardBg, borderRadius: '12px', padding: '16px', border: `1px solid ${borderColor}` }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>5-Day Forecast</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {forecast.map((day) => (
              <div key={day.day} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '12px', color: isDark ? '#aaa' : '#888' }}>{day.day}</div>
                <div style={{ fontSize: '24px', margin: '4px 0' }}>{day.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{day.high}{'\u00B0'}</div>
                <div style={{ fontSize: '12px', color: isDark ? '#777' : '#aaa' }}>{day.low}{'\u00B0'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ color: '#e74c3c', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
    </div>
  );
}
