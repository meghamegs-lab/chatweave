import { useState, useEffect, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  postMessage bridge                                                 */
/* ------------------------------------------------------------------ */

let messageCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function sendToParent(message: any): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockArtists = [
  'Lo-fi beats',
  'Chill Vibes',
  'Study Music',
  'Jazz Cafe',
  'Ambient Works',
  'Piano Dreams',
  'Acoustic Sessions',
  'Nature Sounds',
  'Classical Focus',
  'Electronic Study',
];

interface Track {
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  uri: string;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
  created_at: string;
}

const mockTracks = (query: string, limit: number = 10): Track[] => {
  const tracks: Track[] = [];
  for (let i = 0; i < limit; i++) {
    tracks.push({
      name: `${query} - Track ${i + 1}`,
      artist: mockArtists[i % mockArtists.length],
      album: `${query} Collection`,
      duration_ms: 180000 + Math.floor(Math.random() * 120000),
      uri: `spotify:track:mock${Date.now()}${i}`,
    });
  }
  return tracks;
};

const mockUserPlaylists: Playlist[] = [
  {
    id: 'pl_1',
    name: 'Morning Chill',
    description: 'Easy listening for mornings',
    tracks: mockTracks('Morning', 5),
    created_at: '2025-12-01',
  },
  {
    id: 'pl_2',
    name: 'Focus Flow',
    description: 'Deep concentration vibes',
    tracks: mockTracks('Focus', 8),
    created_at: '2025-12-15',
  },
  {
    id: 'pl_3',
    name: 'Weekend Party',
    description: 'Dance hits for the weekend',
    tracks: mockTracks('Party', 12),
    created_at: '2026-01-05',
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type View =
  | { kind: 'idle' }
  | { kind: 'search_results'; query: string; tracks: Track[] }
  | { kind: 'playlist_created'; playlist: Playlist }
  | { kind: 'user_playlists'; playlists: Playlist[] };

const SPOTIFY_GREEN = '#1DB954';
const SPOTIFY_GREEN_HOVER = '#1ed760';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [initialized, setInitialized] = useState(false);
  const [createdPlaylists, setCreatedPlaylists] = useState<Playlist[]>([]);

  const isDark = theme === 'dark';

  /* ---- Tool handler ---- */

  const handleToolInvoke = useCallback(
    (messageId: string, toolName: string, parameters: Record<string, any>) => {
      if (!authenticated) {
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: null,
            error: 'Spotify is not connected. Please click "Connect Spotify" in the plugin UI first.',
          },
        });
        return;
      }

      switch (toolName) {
        case 'search_tracks': {
          const query = parameters.query as string;
          const limit = Math.min((parameters.limit as number) || 10, 50);
          const tracks = mockTracks(query, limit);

          setView({ kind: 'search_results', query, tracks });

          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: {
              result: {
                query,
                tracks: tracks.map((t) => ({
                  name: t.name,
                  artist: t.artist,
                  album: t.album,
                  duration: formatDuration(t.duration_ms),
                  uri: t.uri,
                })),
                total: tracks.length,
              },
            },
          });

          sendToParent({
            type: 'STATE_UPDATE',
            messageId: generateMessageId(),
            payload: {
              state: { lastSearch: query, resultCount: tracks.length },
              summary: `Found ${tracks.length} tracks for "${query}"`,
            },
          });
          break;
        }

        case 'create_playlist': {
          const name = parameters.name as string;
          const description = (parameters.description as string) || '';
          const trackUris = (parameters.track_uris as string[]) || [];

          // Resolve tracks from URIs (in mock we just generate them)
          const tracks: Track[] = trackUris.map((uri, i) => ({
            name: `Track ${i + 1}`,
            artist: mockArtists[i % mockArtists.length],
            album: name,
            duration_ms: 180000 + Math.floor(Math.random() * 120000),
            uri,
          }));

          const playlist: Playlist = {
            id: `pl_new_${Date.now()}`,
            name,
            description,
            tracks,
            created_at: new Date().toISOString().split('T')[0],
          };

          setCreatedPlaylists((prev) => [...prev, playlist]);
          setView({ kind: 'playlist_created', playlist });

          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: {
              result: {
                playlist_id: playlist.id,
                name: playlist.name,
                description: playlist.description,
                track_count: tracks.length,
                url: `https://open.spotify.com/playlist/${playlist.id}`,
              },
            },
          });

          sendToParent({
            type: 'PLUGIN_COMPLETE',
            messageId: generateMessageId(),
            payload: {
              event: 'playlist_created',
              data: {
                playlist_id: playlist.id,
                name: playlist.name,
                track_count: tracks.length,
              },
              summary: `Created playlist "${playlist.name}" with ${tracks.length} tracks`,
            },
          });
          break;
        }

        case 'get_user_playlists': {
          const allPlaylists = [...mockUserPlaylists, ...createdPlaylists];
          setView({ kind: 'user_playlists', playlists: allPlaylists });

          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: {
              result: {
                playlists: allPlaylists.map((p) => ({
                  id: p.id,
                  name: p.name,
                  description: p.description,
                  track_count: p.tracks.length,
                })),
                total: allPlaylists.length,
              },
            },
          });

          sendToParent({
            type: 'STATE_UPDATE',
            messageId: generateMessageId(),
            payload: {
              state: { playlistCount: allPlaylists.length },
              summary: `User has ${allPlaylists.length} playlists`,
            },
          });
          break;
        }

        default:
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: `Unknown tool: ${toolName}` },
          });
      }
    },
    [authenticated, createdPlaylists],
  );

  /* ---- Message listener ---- */

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'PLUGIN_INIT':
          setTheme(data.payload?.theme || 'light');
          document.body.className = data.payload?.theme || 'light';
          setInitialized(true);
          break;
        case 'TOOL_INVOKE':
          handleToolInvoke(data.messageId, data.payload.toolName, data.payload.parameters);
          break;
        case 'THEME_UPDATE':
          setTheme(data.payload?.theme || 'light');
          document.body.className = data.payload?.theme || 'light';
          break;
        case 'PLUGIN_DESTROY':
          setView({ kind: 'idle' });
          break;
      }
    };

    window.addEventListener('message', handler);

    // Send PLUGIN_READY
    sendToParent({
      type: 'PLUGIN_READY',
      messageId: generateMessageId(),
      payload: { version: '1.0.0' },
    });

    return () => window.removeEventListener('message', handler);
  }, [handleToolInvoke]);

  /* ---- Styles ---- */

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    gap: '16px',
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    minHeight: '100vh',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    background: isDark ? '#282828' : '#ffffff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: isDark ? '#fff' : '#191414',
    marginBottom: '12px',
  };

  const subTextStyle: React.CSSProperties = {
    fontSize: '13px',
    color: isDark ? '#b3b3b3' : '#6a6a6a',
  };

  const buttonStyle: React.CSSProperties = {
    background: SPOTIFY_GREEN,
    color: '#fff',
    border: 'none',
    borderRadius: '24px',
    padding: '12px 32px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
    letterSpacing: '0.5px',
  };

  const trackRowStyle = (index: number): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: '32px 1fr 1fr 60px',
    gap: '8px',
    alignItems: 'center',
    padding: '8px 4px',
    borderRadius: '4px',
    background: index % 2 === 0 ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent',
    fontSize: '13px',
  });

  const trackHeaderStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '32px 1fr 1fr 60px',
    gap: '8px',
    alignItems: 'center',
    padding: '4px 4px 8px',
    borderBottom: `1px solid ${isDark ? '#404040' : '#e0e0e0'}`,
    marginBottom: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: isDark ? '#b3b3b3' : '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  };

  /* ---- Connect Spotify screen ---- */

  if (!authenticated) {
    return (
      <div
        style={{
          ...containerStyle,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '8px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill={SPOTIFY_GREEN}>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
        <h2 style={{ ...headingStyle, marginBottom: '4px' }}>Spotify Playlist Creator</h2>
        <p style={{ ...subTextStyle, marginBottom: '20px', maxWidth: '320px' }}>
          Connect your Spotify account to search tracks, create playlists, and manage your music library with AI
          assistance.
        </p>
        <button
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = SPOTIFY_GREEN_HOVER;
            e.currentTarget.style.transform = 'scale(1.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = SPOTIFY_GREEN;
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onClick={() => setAuthenticated(true)}
        >
          Connect Spotify
        </button>
      </div>
    );
  }

  /* ---- Idle screen ---- */

  if (view.kind === 'idle') {
    return (
      <div
        style={{
          ...containerStyle,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '4px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill={SPOTIFY_GREEN}>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
        <p style={{ fontSize: '15px', fontWeight: 600, color: isDark ? '#fff' : '#191414' }}>
          Waiting for playlist request...
        </p>
        <p style={{ ...subTextStyle, maxWidth: '300px' }}>
          Ask the chatbot to search for tracks, create a playlist, or show your existing playlists.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '4px',
            fontSize: '12px',
            color: SPOTIFY_GREEN,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: SPOTIFY_GREEN,
              display: 'inline-block',
            }}
          />
          Connected
        </div>
      </div>
    );
  }

  /* ---- Search results ---- */

  if (view.kind === 'search_results') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h3 style={headingStyle}>
            Search Results for "{view.query}"
          </h3>
          <p style={{ ...subTextStyle, marginBottom: '12px' }}>{view.tracks.length} tracks found</p>

          <div style={trackHeaderStyle}>
            <span>#</span>
            <span>Title</span>
            <span>Artist</span>
            <span>Duration</span>
          </div>
          {view.tracks.map((track, i) => (
            <div key={track.uri} style={trackRowStyle(i)}>
              <span style={{ color: isDark ? '#b3b3b3' : '#999', fontSize: '12px' }}>{i + 1}</span>
              <span
                style={{
                  fontWeight: 500,
                  color: isDark ? '#fff' : '#191414',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {track.name}
              </span>
              <span style={{ color: isDark ? '#b3b3b3' : '#6a6a6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.artist}
              </span>
              <span style={{ color: isDark ? '#b3b3b3' : '#6a6a6a', textAlign: 'right' }}>
                {formatDuration(track.duration_ms)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---- Playlist created ---- */

  if (view.kind === 'playlist_created') {
    const { playlist } = view;
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '4px',
                background: `linear-gradient(135deg, ${SPOTIFY_GREEN}, #191414)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
            </div>
            <div>
              <h3 style={{ ...headingStyle, marginBottom: '2px' }}>{playlist.name}</h3>
              {playlist.description && (
                <p style={{ ...subTextStyle, marginBottom: '2px' }}>{playlist.description}</p>
              )}
              <p style={{ ...subTextStyle, fontSize: '12px' }}>
                {playlist.tracks.length} tracks &middot; Created just now
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: SPOTIFY_GREEN,
              color: '#fff',
              borderRadius: '12px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            Playlist Created
          </div>

          <div style={trackHeaderStyle}>
            <span>#</span>
            <span>Title</span>
            <span>Artist</span>
            <span>Duration</span>
          </div>
          {playlist.tracks.map((track, i) => (
            <div key={track.uri} style={trackRowStyle(i)}>
              <span style={{ color: isDark ? '#b3b3b3' : '#999', fontSize: '12px' }}>{i + 1}</span>
              <span
                style={{
                  fontWeight: 500,
                  color: isDark ? '#fff' : '#191414',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {track.name}
              </span>
              <span style={{ color: isDark ? '#b3b3b3' : '#6a6a6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.artist}
              </span>
              <span style={{ color: isDark ? '#b3b3b3' : '#6a6a6a', textAlign: 'right' }}>
                {formatDuration(track.duration_ms)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---- User playlists ---- */

  if (view.kind === 'user_playlists') {
    return (
      <div style={containerStyle}>
        <h3 style={headingStyle}>Your Playlists</h3>
        <p style={{ ...subTextStyle, marginTop: '-8px', marginBottom: '4px' }}>
          {view.playlists.length} playlists
        </p>
        {view.playlists.map((playlist) => (
          <div key={playlist.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '4px',
                  background: `linear-gradient(135deg, ${SPOTIFY_GREEN}, #191414)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                  <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                </svg>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: isDark ? '#fff' : '#191414',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {playlist.name}
                </div>
                <div style={subTextStyle}>
                  {playlist.tracks.length} tracks &middot; {playlist.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
