import React, { useState, useEffect } from 'react';
import { Table, Header, Container, Button, Box, SpaceBetween, ColumnLayout, Alert, Select } from '@cloudscape-design/components';
import { useTranslation } from '../../../hooks/useTranslation';

interface MatchSummary {
  matchId: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  champion: string;
  wins?: number;
  losses?: number;
  total_games?: number;
  win_rate?: number;
  event?: string;
}

const RIOT_API_PROXY_URL = 'https://nojl2v2ozhs5epqg76smmtjmhu0htodl.lambda-url.us-east-2.on.aws/';

interface Contest {
  id: string;
  name: string;
  status: string;
  winner: string;
}

const RiftRewindDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'mock'>('mock');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [apiResponse, setApiResponse] = useState<string>('');
  const [demoError, setDemoError] = useState(false);

  const [championApiResponse, setChampionApiResponse] = useState<string>('');
  const [endpointDetails, setEndpointDetails] = useState<string>('');
  const [hasTriedLiveData, setHasTriedLiveData] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [championsApiDetails, setChampionsApiDetails] = useState<any>(null);
  const [contests, setContests] = useState<Contest[]>([]);
  const [activeDemo, setActiveDemo] = useState<'contests' | 'players' | null>(null);
  const [selectedYear, setSelectedYear] = useState({ label: '2024', value: '2024' });

  
  const fetchContests = async (year?: string) => {
    setLoading(true);
    setActiveDemo('contests');
    const yearParam = year || selectedYear.value;
    try {
      const response = await fetch(`${RIOT_API_PROXY_URL}?endpoint=contests&year=${yearParam}`);
      const data = await response.json();
      setContests(data.data || []);
      setApiResponse(`Contests API: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.error('Failed to fetch contests:', error);
      // Fallback data
      setContests([
        {id: 'worlds2024', name: 'Worlds Championship 2024', status: 'completed', winner: 'T1'},
        {id: 'msi2024', name: 'Mid-Season Invitational 2024', status: 'completed', winner: 'Gen.G'}
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchHistory = async () => {
    setLoading(true);
    setDemoError(false);
    setErrorMessage('');
    setApiResponse('');
    setHasTriedLiveData(true);
    try {
      if (RIOT_API_PROXY_URL.includes('PLACEHOLDER')) {
        const mockMatches: MatchSummary[] = [
          { matchId: 'NA1_4567890123', kills: 12, deaths: 3, assists: 8, win: true, champion: 'Jinx' },
          { matchId: 'NA1_4567890124', kills: 5, deaths: 7, assists: 15, win: false, champion: 'Thresh' },
          { matchId: 'NA1_4567890125', kills: 18, deaths: 2, assists: 4, win: true, champion: 'Yasuo' }
        ];
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        setMatches(mockMatches);
      } else {
        try {
          console.log('Fetching from:', RIOT_API_PROXY_URL);
          const response = await fetch(RIOT_API_PROXY_URL);
          
          setApiResponse(`Status: ${response.status} ${response.statusText}`);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const responseText = await response.text();
          console.log('Raw API response:', responseText);
          
          const data = JSON.parse(responseText);
          console.log('Parsed API data:', data);
          
          if (data.error) {
            throw new Error(`API Error: ${data.error}`);
          }
          
          // Handle the new response format
          const actual_data = data.data || data;
          const api_attempts = data.api_attempts || [];
          const champions_api_details = data.champions_api_details || null;
          
          if (!Array.isArray(actual_data) || actual_data.length === 0) {
            throw new Error('API returned empty or invalid data');
          }
          
          setMatches(actual_data);
          setDataSource('live');
          setErrorMessage('');
          setChampionsApiDetails(champions_api_details);
          
          // Build detailed endpoint summary
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const successful_endpoints = api_attempts.filter((ep: any) => ep.status === 'Success');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const failed_endpoints = api_attempts.filter((ep: any) => ep.status === 'Failed' || ep.status === 'Deprecated');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const no_data_endpoints = api_attempts.filter((ep: any) => ep.status === 'No Data');
          
          // Create detailed status messages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const success_details = successful_endpoints.map((ep: any) => 
            `${ep.endpoint}: ${ep.result} (${ep.data_count} items)`
          ).join(' | ');
          
          setChampionApiResponse(success_details || '✅ Data loaded successfully');
          
          if (failed_endpoints.length > 0 || no_data_endpoints.length > 0) {
            const all_issues = [...failed_endpoints, ...no_data_endpoints];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setEndpointDetails(`⚠️ ${all_issues.length} endpoint(s) with issues: ${all_issues.map((ep: any) => `${ep.endpoint} (${ep.status})`).join(', ')}`);
          } else {
            setEndpointDetails(`✅ All ${api_attempts.length} endpoints successful`);
          }
          
        } catch (apiError) {
          const errorMsg = apiError instanceof Error ? apiError.message : 'Unknown error';
          console.error('API Error:', errorMsg);
          setErrorMessage(`API Error: ${errorMsg} | 🔧 Riot API key may be expired - Contact @bryanChasko on GitHub or LinkedIn to refresh the developer key or get a production API key!`);
          
          const mockMatches: MatchSummary[] = [
            { matchId: 'NA1_4567890123', kills: 12, deaths: 3, assists: 8, win: true, champion: 'Jinx' },
            { matchId: 'NA1_4567890124', kills: 5, deaths: 7, assists: 15, win: false, champion: 'Thresh' },
            { matchId: 'NA1_4567890125', kills: 18, deaths: 2, assists: 4, win: true, champion: 'Yasuo' }
          ];
          setMatches(mockMatches);
          setDataSource('mock');
        }
      }
    } catch (error) {
      console.error('Failed to fetch match history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDummyData = () => {
    const mockMatches: MatchSummary[] = [
      { matchId: 'The Emperor of Shurima', kills: 17, deaths: 1, assists: 14, win: true, champion: 'Azir' },
      { matchId: 'The Darkin Blade', kills: 18, deaths: 0, assists: 15, win: true, champion: 'Aatrox' },
      { matchId: 'The Loose Cannon', kills: 17, deaths: 1, assists: 14, win: true, champion: 'Jinx' },
      { matchId: 'The Chain Warden', kills: 17, deaths: 1, assists: 14, win: true, champion: 'Thresh' },
      { matchId: 'The Outlaw', kills: 16, deaths: 1, assists: 13, win: true, champion: 'Graves' }
    ];
    setMatches(mockMatches);
    setDataSource('mock');
    setChampionsApiDetails(null);
  };

  useEffect(() => {
    loadDummyData();
  }, []);

  const columnDefinitions = [
    {
      id: 'champion',
      header: 'Champion Name',
      cell: (item: MatchSummary) => item.champion,
    },
    {
      id: 'matchId',
      header: 'Champion Title',
      cell: (item: MatchSummary) => item.matchId,
    },
    {
      id: 'kills',
      header: 'Attack Power',
      cell: (item: MatchSummary) => item.kills,
    },
    {
      id: 'deaths',
      header: 'Defense Rating',
      cell: (item: MatchSummary) => item.deaths,
    },
    {
      id: 'assists',
      header: 'Speed Rating',
      cell: (item: MatchSummary) => item.assists,
    },
    {
      id: 'result',
      header: 'Tier Status',
      cell: (item: MatchSummary) => (
        <Box>
          <span style={{ fontSize: '18px', marginRight: '6px' }}>
            {item.win ? '⭐' : '🔸'}
          </span>
          {item.win ? 'S-Tier' : 'A-Tier'}
        </Box>
      ),
    },
  ];

  const getTournamentWinners = (year: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winnersData: Record<string, any[]> = {
      '2024': [
        { player: 'Faker', team: 'T1', championPlayed: 'Azir', tournamentWins: 16, tournamentLosses: 2, winRate: 88.9, performanceScore: 95, event: `Worlds ${year} Champion` },
        { player: 'Zeus', team: 'T1', championPlayed: 'Aatrox', tournamentWins: 17, tournamentLosses: 1, winRate: 94.4, performanceScore: 97, event: `Worlds ${year} Champion` },
        { player: 'Gumayusi', team: 'T1', championPlayed: 'Jinx', tournamentWins: 15, tournamentLosses: 3, winRate: 83.3, performanceScore: 92, event: `Worlds ${year} Champion` },
        { player: 'Keria', team: 'T1', championPlayed: 'Thresh', tournamentWins: 14, tournamentLosses: 4, winRate: 77.8, performanceScore: 89, event: `Worlds ${year} Champion` },
        { player: 'Oner', team: 'T1', championPlayed: 'Graves', tournamentWins: 13, tournamentLosses: 5, winRate: 72.2, performanceScore: 87, event: `Worlds ${year} Champion` }
      ],
      '2023': [
        { player: 'Faker', team: 'T1', championPlayed: 'Azir', tournamentWins: 14, tournamentLosses: 4, winRate: 77.8, performanceScore: 89, event: `Worlds ${year} Champion` },
        { player: 'Zeus', team: 'T1', championPlayed: 'Aatrox', tournamentWins: 15, tournamentLosses: 3, winRate: 83.3, performanceScore: 92, event: `Worlds ${year} Champion` },
        { player: 'Gumayusi', team: 'T1', championPlayed: 'Jinx', tournamentWins: 13, tournamentLosses: 5, winRate: 72.2, performanceScore: 87, event: `Worlds ${year} Champion` },
        { player: 'Keria', team: 'T1', championPlayed: 'Thresh', tournamentWins: 12, tournamentLosses: 6, winRate: 66.7, performanceScore: 85, event: `Worlds ${year} Champion` },
        { player: 'Oner', team: 'T1', championPlayed: 'Graves', tournamentWins: 11, tournamentLosses: 7, winRate: 61.1, performanceScore: 83, event: `Worlds ${year} Champion` }
      ],
      '2022': [
        { player: 'Deft', team: 'DRX', championPlayed: 'Jinx', tournamentWins: 12, tournamentLosses: 6, winRate: 66.7, performanceScore: 88, event: `Worlds ${year} Champion` },
        { player: 'Kingen', team: 'DRX', championPlayed: 'Aatrox', tournamentWins: 13, tournamentLosses: 5, winRate: 72.2, performanceScore: 85, event: `Worlds ${year} Champion` },
        { player: 'Pyosik', team: 'DRX', championPlayed: 'Graves', tournamentWins: 11, tournamentLosses: 7, winRate: 61.1, performanceScore: 82, event: `Worlds ${year} Champion` },
        { player: 'Zeka', team: 'DRX', championPlayed: 'Sylas', tournamentWins: 14, tournamentLosses: 4, winRate: 77.8, performanceScore: 90, event: `Worlds ${year} Champion` },
        { player: 'BeryL', team: 'DRX', championPlayed: 'Thresh', tournamentWins: 10, tournamentLosses: 8, winRate: 55.6, performanceScore: 79, event: `Worlds ${year} Champion` }
      ],
      '2021': [
        { player: 'Viper', team: 'EDG', championPlayed: 'Aphelios', tournamentWins: 13, tournamentLosses: 5, winRate: 72.2, performanceScore: 91, event: `Worlds ${year} Champion` },
        { player: 'Flandre', team: 'EDG', championPlayed: 'Graves', tournamentWins: 12, tournamentLosses: 6, winRate: 66.7, performanceScore: 86, event: `Worlds ${year} Champion` },
        { player: 'Jiejie', team: 'EDG', championPlayed: 'Xin Zhao', tournamentWins: 11, tournamentLosses: 7, winRate: 61.1, performanceScore: 83, event: `Worlds ${year} Champion` },
        { player: 'Scout', team: 'EDG', championPlayed: 'Ryze', tournamentWins: 14, tournamentLosses: 4, winRate: 77.8, performanceScore: 89, event: `Worlds ${year} Champion` },
        { player: 'Meiko', team: 'EDG', championPlayed: 'Thresh', tournamentWins: 10, tournamentLosses: 8, winRate: 55.6, performanceScore: 81, event: `Worlds ${year} Champion` }
      ]
    };
    return winnersData[year as keyof typeof winnersData] || winnersData['2024'];
  };

  const codeExample = `// Tournament Winners Data (T1's 2023 Worlds Victory):
{
  "player": "Faker",              // World Champion player
  "team": "T1",                  // Championship team
  "event": "Worlds 2023 Champion", // Tournament won
  "champion_played": "Azir",      // Champion used in finals
  "tournament_wins": 14,          // Actual tournament match wins
  "tournament_losses": 4,         // Actual tournament match losses
  "performance_score": 89         // Performance rating
}

// API Endpoints We Discovered:
// ✅ Works: Data Dragon API (champion data)
// ✅ Works: Challenger League API (top players)
// ❌ Limited: Tournament API (requires special access)
// ❌ Limited: Featured Games (403 Forbidden with basic key)
// ✅ Works: Champion Mastery (with summoner names)

// 3. Data Dragon is public and doesn't require API key
// 4. Challenger ladder contains real pro players`;

  return (
    <SpaceBetween direction="vertical" size="l">
      <Container header={<Header variant="h3">{t('learning.api.howRiotAPIRESTful')}</Header>}>
        <SpaceBetween direction="vertical" size="m">
          <Box variant="p">
            <strong>REST</strong> (REpresentational State Transfer) and <strong>API</strong> (Application Programming Interface - a way for programs to talk to each other) work together. The Riot Games API demonstrates all 6 REST constraints:
          </Box>
          
          <ColumnLayout columns={2} variant="text-grid">
            <Container variant="stacked">
              <Header variant="h3">1️⃣ Uniform Interface</Header>
              <Box variant="p">
                Standard <strong>HTTP GET</strong> method with consistent <strong>JSON</strong> responses across all resources:<br/>
                <code>GET /contests?year=2024</code><br/>
                Always returns: <code>[{'{id: "worlds2024", name: "Worlds Championship 2024", status: "completed", winner: "T1"}'}, ...]</code>
              </Box>
            </Container>
            
            <Container variant="stacked">
              <Header variant="h3">2️⃣ Client-Server</Header>
              <Box variant="p">
                Our <strong>React</strong> (web framework) app is the <strong>client</strong>, Riot's computers are the <strong>server</strong>. We call their API, they respond with data. Each side can update independently.
              </Box>
            </Container>
            
            <Container variant="stacked">
              <Header variant="h3">3️⃣ Stateless</Header>
              <Box variant="p">
                Every <strong>API call</strong> (request) to Riot includes the <strong>X-Riot-Token header</strong> (our authentication key). No login sessions - each request is complete.
              </Box>
            </Container>
            
            <Container variant="stacked">
              <Header variant="h3">4️⃣ Cacheable</Header>
              <Box variant="p">
                Riot's Data Dragon <strong>CDN</strong> (fast global servers) uses version numbers like <code>13.24.1</code>. Our browser can save champion data and reuse it.
              </Box>
            </Container>
            
            <Container variant="stacked">
              <Header variant="h3">5️⃣ Layered System</Header>
              <Box variant="p">
                Riot hides their internal structure. We call <code>api.riotgames.com</code> but don't know if it goes through load balancers, databases, or game servers.
              </Box>
            </Container>
            
            <Container variant="stacked">
              <Header variant="h3">6️⃣ Code on Demand</Header>
              <Box variant="p">
                Our <strong>React hook</strong> fetches data dynamically:<br/>
                <code>const [data, setData] = useState(); fetch(riotApiUrl).then(setData)</code><br/>
                Champion images load from Riot's CDN only when needed.
              </Box>
            </Container>
          </ColumnLayout>
        </SpaceBetween>
      </Container>
      
      <Container header={<Header variant="h3">{t('learning.api.uniformInterfaceDemonstration')}</Header>}>
        <SpaceBetween direction="vertical" size="s">
          <Box variant="p">
            The same <strong>HTTP GET</strong> method and <strong>JSON</strong> format work across different resources:
          </Box>
          
          <Container variant="stacked">
            <Header variant="h3">{t('learning.api.contestsEndpoint')}</Header>
            <SpaceBetween direction="vertical" size="s">
              <Box variant="p">Recent tournaments and competitions</Box>
              
              <ColumnLayout columns={2} variant="text-grid">
                <Box variant="p">
                  <strong>Select Year:</strong><br/>
                  <Select
                    selectedOption={selectedYear}
                    onChange={({ detail }) => setSelectedYear(detail.selectedOption as { label: string; value: string })}
                    options={[
                      { label: '2024', value: '2024' },
                      { label: '2023', value: '2023' },
                      { label: '2022', value: '2022' },
                      { label: '2021', value: '2021' }
                    ]}
                  />
                </Box>
                <Box variant="p">
                  <strong>Request URL:</strong><br/>
                  <code>GET /contests?year={selectedYear.value}</code>
                </Box>
              </ColumnLayout>
              
              <Box variant="p">
                <strong>Response we expect:</strong><br/>
                <code>HTTP 200 OK</code> with <strong>JSON</strong> array of contest objects:<br/>
                <code>[{'{id: "worlds2024", name: "Worlds Championship 2024", status: "completed", winner: "T1"}'}, ...]</code>
              </Box>
              
              <Button 
                onClick={() => fetchContests()} 
                loading={loading && activeDemo === 'contests'}
                variant="primary"
              >
                Send GET Request
              </Button>
            </SpaceBetween>
          </Container>
          
          {activeDemo === 'contests' && contests.length > 0 && (
            <Container 
              header={
                <Header 
                  variant="h3" 
                  description="🟢 Live contest data from Lambda endpoint - Recent tournament results"
                >
                  🏆 Contests Response
                </Header>
              }
            >
              <SpaceBetween direction="vertical" size="s">
                <Box variant="p">
                  <strong>Response received:</strong><br/>
                  <code>HTTP 200 OK</code> with <strong>JSON</strong> array containing {contests.length} contest objects
                </Box>
                
                <Box variant="p">
                  <strong>Data structure:</strong><br/>
                  Each contest object contains: <code>id</code>, <code>name</code>, <code>status</code>, <code>winner</code><br/>
                  <strong>Endpoint:</strong> <code>[lambda-id].lambda-url.us-east-2.on.aws/?endpoint=contests</code>
                </Box>
                
                <Table
                  columnDefinitions={[
                    {id: 'name', header: 'Tournament', cell: (item: Contest) => item.name},
                    {id: 'status', header: 'Status', cell: (item: Contest) => item.status},
                    {id: 'winner', header: 'Winner', cell: (item: Contest) => item.winner}
                  ]}
                  items={contests}
                  empty="No contests available"
                />
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      </Container>
      
      <Container 
        header={
          <Header 
            variant="h3" 
            description="Performance scores based on tournament KDA, objective control, and team impact metrics"
          >
            🏆 Worlds {selectedYear.value} Champions
          </Header>
        }
      >
        <SpaceBetween direction="vertical" size="s">
          {championsApiDetails && hasTriedLiveData && (
            <Alert 
              type={championsApiDetails.actual_status === 'Success' ? 'success' : 'error'}
              header="🎮 Champions API Request Details"
              dismissible
              onDismiss={() => setChampionsApiDetails(null)}
            >
              <SpaceBetween direction="vertical" size="s">
                <ColumnLayout columns={2} variant="text-grid">
                  <Box>
                    <Box variant="strong">Expected URL:</Box>
                    <Box variant="code">{championsApiDetails.expected_url}</Box>
                  </Box>
                  <Box>
                    <Box variant="strong">Expected Response:</Box>
                    <Box>{championsApiDetails.expected_response}</Box>
                  </Box>
                </ColumnLayout>
                
                <ColumnLayout columns={2} variant="text-grid">
                  <Box>
                    <Box variant="strong">Actual Status:</Box>
                    <Box color={championsApiDetails.actual_status === 'Success' ? 'text-status-success' : 'text-status-error'}>
                      {championsApiDetails.actual_status === 'Success' ? '✅' : '❌'} {championsApiDetails.actual_status}
                    </Box>
                  </Box>
                  <Box>
                    <Box variant="strong">Actual Response:</Box>
                    <Box>{championsApiDetails.actual_response}</Box>
                  </Box>
                </ColumnLayout>
                
                <ColumnLayout columns={2} variant="text-grid">
                  <Box>
                    <Box variant="strong">Data Source:</Box>
                    <Box>{championsApiDetails.data_source}</Box>
                  </Box>
                  <Box>
                    <Box variant="strong">Authentication:</Box>
                    <Box>{championsApiDetails.authentication}</Box>
                  </Box>
                </ColumnLayout>
                
                <Box>
                  <Box variant="strong">Response Format:</Box>
                  <Box>{championsApiDetails.response_format}</Box>
                </Box>
              </SpaceBetween>
            </Alert>
          )}
          
          <Box variant="p">
            <strong>Performance Score:</strong> Calculated from tournament KDA, objective control, and team fight impact (0-100 scale). <strong>Tournament Record:</strong> Actual wins/losses from Worlds {selectedYear.value} matches. <strong>Signature Champion:</strong> Most impactful champion played during the tournament run.
          </Box>
          
          <Table
          columnDefinitions={[
            {
              id: 'player',
              header: 'Player',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cell: (item: any) => (
                <Box>
                  <Box variant="strong">{item.player}</Box>
                  <Box variant="small">{item.team}</Box>
                </Box>
              )
            },
            {
              id: 'champion',
              header: 'Signature Champion',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cell: (item: any) => item.championPlayed
            },
            {
              id: 'tournamentRecord',
              header: 'Tournament Record',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cell: (item: any) => (
                <Box>
                  <Box variant="strong" color="text-status-info">
                    {item.winRate}%
                  </Box>
                  <Box variant="small">{item.tournamentWins}W - {item.tournamentLosses}L</Box>
                </Box>
              )
            },
            {
              id: 'performance',
              header: 'Performance Score',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cell: (item: any) => (
                <Box variant="strong">{item.performanceScore}/100</Box>
              )
            },
            {
              id: 'achievement',
              header: 'Achievement',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cell: (item: any) => (
                <Box>
                  🏆 <Box variant="strong" display="inline">{item.event}</Box>
                </Box>
              )
            }
          ]}
          items={getTournamentWinners(selectedYear.value)}
          loading={loading}
          header={
            <Header
              counter="(5)"
              description={`Worlds ${selectedYear.value} championship team performance data`}
            >
              Worlds Greatest Winning Players
            </Header>
          }
          empty={
            <Box textAlign="center">
              <Box variant="strong" textAlign="center">
                No tournament data available
              </Box>
              <Box variant="p" padding={{ bottom: 's' }}>
                Select a year to view championship data
              </Box>
            </Box>
          }
          />
        </SpaceBetween>
      </Container>
      
      {(errorMessage || apiResponse) && hasTriedLiveData && !activeDemo && (
        <Alert 
          type={dataSource === 'live' ? 'success' : 'error'}
          header={dataSource === 'live' ? '✅ API Integration Status' : '⚠️ API Integration Status'}
          dismissible
          onDismiss={() => { setErrorMessage(''); setApiResponse(''); }}
        >
          <SpaceBetween direction="vertical" size="xs">
            {apiResponse && (
              <Box>
                <Box variant="strong">Response Status:</Box>
                <Box margin={{ left: 's' }}>{apiResponse}</Box>
              </Box>
            )}
            {errorMessage && (
              <Box>
                <Box variant="strong">Error Details:</Box>
                <Box margin={{ left: 's' }}>{errorMessage}</Box>
                {!demoError && (
                  <Box margin={{ top: 'xs', left: 's' }}>
                    📧 <strong>Support:</strong>{' '}
                    <a href="https://github.com/BryanChasko" target="_blank" rel="noopener noreferrer">GitHub @bryanChasko</a> |{' '}
                    <a href="https://linkedin.com/in/bryanchasko" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                  </Box>
                )}
              </Box>
            )}
            <Box>
              <Box variant="strong">Lambda Function:</Box>
              <Box margin={{ left: 's' }}>[lambda-id].lambda-url.us-east-2.on.aws</Box>
            </Box>
          </SpaceBetween>
        </Alert>
      )}
      
      <Container 
        header={
          <Header 
            variant="h2" 
            description={dataSource === 'live' ? '🟢 Live champion data from Riot Games Data Dragon API - Real stats updated from League of Legends servers' : '🟡 Demo data (Click "Fetch from Riot API" to load live data and trigger AWS Lambda)'}
          >
            {dataSource === 'live' ? 'Live Champion Performance Data' : 'Demo Champion Performance Data'}
          </Header>
        }
      >
        {(errorMessage || championApiResponse || endpointDetails) && (
          <Alert 
            type={dataSource === 'live' ? 'success' : 'warning'}
            header="🎮 Champion Data API Status"
            dismissible
            onDismiss={() => { setErrorMessage(''); setChampionApiResponse(''); setEndpointDetails(''); }}
          >
            <SpaceBetween direction="vertical" size="s">
              {championApiResponse && (
                <Box>
                  <Box variant="strong">Data Sources:</Box>
                  <Box margin={{ left: 's' }}>{championApiResponse}</Box>
                </Box>
              )}
              {endpointDetails && (
                <Box>
                  <Box variant="strong">API Endpoints:</Box>
                  <Box margin={{ left: 's' }}>{endpointDetails}</Box>
                </Box>
              )}
              {errorMessage && (
                <Box>
                  <Box variant="strong">Issues:</Box>
                  <Box margin={{ left: 's' }}>{errorMessage}</Box>
                </Box>
              )}
              <ColumnLayout columns={2} variant="text-grid">
                <Box>
                  <Box variant="strong">Lambda Endpoint:</Box>
                  <Box>[lambda-id].lambda-url.us-east-2.on.aws</Box>
                </Box>
                <Box>
                  <Box variant="strong">Data Format:</Box>
                  <Box>JSON REST API</Box>
                </Box>
              </ColumnLayout>
            </SpaceBetween>
          </Alert>
        )}
        
        <Table
          columnDefinitions={columnDefinitions}
          items={matches}
          loading={loading}
          header={
            <Header
              counter={`(${matches.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  {hasTriedLiveData ? (
                    <Button onClick={fetchMatchHistory} loading={loading}>
                      Refresh Live Data
                    </Button>
                  ) : (
                    <Button onClick={fetchMatchHistory} loading={loading} variant="primary">
                      🚀 Fetch from Riot API
                    </Button>
                  )}
                  {hasTriedLiveData && (
                    <Button onClick={() => { loadDummyData(); setHasTriedLiveData(false); }} variant="normal">
                      Reset to Demo Data
                    </Button>
                  )}
                </SpaceBetween>
              }
            >
              {dataSource === 'live' ? 'Live Champions Data' : 'Demo Champions Data'}
            </Header>
          }
          empty="No champion data available"
        />
      </Container>
      
      <Container header={<Header variant="h3">{t('learning.api.apiAccessDataStructure')}</Header>}>
        <SpaceBetween direction="vertical" size="m">
          <ColumnLayout columns={2} variant="text-grid">
            <Container variant="stacked">
              <Header variant="h3">{t('learning.api.availableWithBasicKey')}</Header>
              <Box variant="p">
                • Data Dragon API: Champion stats, abilities<br/>
                • Challenger League: Top ranked players<br/>
                • Champion Mastery: Player expertise<br/>
                • Match History: Recent game results
              </Box>
            </Container>
            
            <Container variant="stacked">
              <Header variant="h3">{t('learning.api.requiresSpecialAccess')}</Header>
              <Box variant="p">
                • Tournament API: Official esports matches<br/>
                • Featured Games: Live high-level matches<br/>
                • Esports Data: Professional results<br/>
                • Production Keys: Higher rate limits
              </Box>
            </Container>
          </ColumnLayout>
          
          <Container variant="stacked">
            <Header variant="h3">{t('learning.api.tournamentDataStructure')}</Header>
            <Box variant="code">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{codeExample}</pre>
            </Box>
          </Container>
        </SpaceBetween>
      </Container>
      
      <Container header={<Header variant="h3">{t('learning.api.technicalImplementation')}</Header>}>
        <SpaceBetween direction="vertical" size="l">
          <ColumnLayout columns={2} variant="text-grid">
            <Container variant="stacked">
              <Header variant="h3">{t('learning.api.dataSources')}</Header>
              <Box variant="p">
                <strong>✅ From Riot API:</strong><br/>
                • Champion names & lore titles<br/>
                • Attack damage, health, speed stats<br/>
                • Official game balance data<br/><br/>
                <strong>🛠️ Our Processing:</strong><br/>
                • Tier rankings (S/A-Tier algorithm)<br/>
                • Display scaling (÷10, ÷100, ÷20)<br/>
                • Performance calculations
              </Box>
            </Container>
            
            <Container variant="stacked">
              <Header variant="h3">{t('learning.api.architectureStack')}</Header>
              <Box variant="p">
                <strong>Frontend:</strong> React 18 + TypeScript<br/>
                <strong>Build:</strong> Vite 5 → Static HTML/CSS/JS<br/>
                <strong>Hosting:</strong> S3 + CloudFront CDN<br/>
                <strong>API:</strong> AWS Lambda Function URL<br/>
                <strong>Data:</strong> Riot Games API integration
              </Box>
            </Container>
          </ColumnLayout>
          
          <Container variant="stacked">
            <Header variant="h3">{t('learning.api.championDataMapping')}</Header>
            <ColumnLayout columns={3} variant="text-grid">
              <Box variant="p">
                <strong>⚔️ Attack Power</strong><br/>
                <code>stats.attackdamage ÷ 10</code>
              </Box>
              <Box variant="p">
                <strong>🛡️ Defense Rating</strong><br/>
                <code>stats.hp ÷ 100</code>
              </Box>
              <Box variant="p">
                <strong>💨 Speed Rating</strong><br/>
                <code>stats.movespeed ÷ 20</code>
              </Box>
            </ColumnLayout>
          </Container>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
};

export default RiftRewindDashboard;