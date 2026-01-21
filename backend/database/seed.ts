import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'betting_platform',
  user: process.env.DB_USER || 'betting',
  password: process.env.DB_PASSWORD || 'betting123',
});

interface EventData {
  sport: string;
  name: string;
  home_team: string;
  away_team: string;
  start_time: Date;
  markets: MarketData[];
}

interface MarketData {
  name: string;
  type: string;
  selections: SelectionData[];
}

interface SelectionData {
  name: string;
  odds: number;
}

function randomOdds(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function futureDate(daysMin: number, daysMax: number): Date {
  const now = new Date();
  const days = daysMin + Math.random() * (daysMax - daysMin);
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

const footballTeams = [
  ['Manchester United', 'Liverpool'],
  ['Arsenal', 'Chelsea'],
  ['Manchester City', 'Tottenham'],
  ['Barcelona', 'Real Madrid'],
  ['Bayern Munich', 'Borussia Dortmund'],
  ['PSG', 'Lyon'],
  ['Juventus', 'AC Milan'],
  ['Inter Milan', 'Napoli'],
  ['Ajax', 'PSV'],
  ['Benfica', 'Porto'],
];

const basketballTeams = [
  ['Lakers', 'Celtics'],
  ['Warriors', 'Nets'],
  ['Bucks', 'Heat'],
  ['Suns', 'Nuggets'],
  ['76ers', 'Knicks'],
  ['Bulls', 'Cavaliers'],
  ['Mavericks', 'Clippers'],
  ['Grizzlies', 'Timberwolves'],
  ['Pelicans', 'Hawks'],
  ['Raptors', 'Pacers'],
];

const tennisPlayers = [
  ['Djokovic', 'Nadal'],
  ['Alcaraz', 'Sinner'],
  ['Medvedev', 'Zverev'],
  ['Rublev', 'Tsitsipas'],
  ['Fritz', 'Ruud'],
  ['Hurkacz', 'Tiafoe'],
  ['de Minaur', 'Rune'],
  ['Paul', 'Dimitrov'],
  ['Shelton', 'Draper'],
  ['Auger-Aliassime', 'Khachanov'],
];

function generateEvents(): EventData[] {
  const events: EventData[] = [];

  for (const [home, away] of footballTeams) {
    const homeOdds = randomOdds(1.5, 4.0);
    const drawOdds = randomOdds(2.5, 4.5);
    const awayOdds = randomOdds(1.5, 4.0);

    events.push({
      sport: 'football',
      name: `${home} vs ${away}`,
      home_team: home,
      away_team: away,
      start_time: futureDate(1, 14),
      markets: [
        {
          name: 'Match Result',
          type: 'match_winner',
          selections: [
            { name: home, odds: homeOdds },
            { name: 'Draw', odds: drawOdds },
            { name: away, odds: awayOdds },
          ],
        },
        {
          name: 'Total Goals',
          type: 'over_under',
          selections: [
            { name: 'Over 2.5', odds: randomOdds(1.7, 2.3) },
            { name: 'Under 2.5', odds: randomOdds(1.5, 2.1) },
          ],
        },
        {
          name: 'Both Teams to Score',
          type: 'btts',
          selections: [
            { name: 'Yes', odds: randomOdds(1.6, 2.2) },
            { name: 'No', odds: randomOdds(1.5, 2.0) },
          ],
        },
      ],
    });
  }

  for (const [home, away] of basketballTeams) {
    const homeOdds = randomOdds(1.3, 3.0);
    const awayOdds = randomOdds(1.3, 3.0);

    events.push({
      sport: 'basketball',
      name: `${home} vs ${away}`,
      home_team: home,
      away_team: away,
      start_time: futureDate(1, 10),
      markets: [
        {
          name: 'Match Winner',
          type: 'match_winner',
          selections: [
            { name: home, odds: homeOdds },
            { name: away, odds: awayOdds },
          ],
        },
        {
          name: 'Total Points',
          type: 'over_under',
          selections: [
            { name: 'Over 220.5', odds: randomOdds(1.8, 2.0) },
            { name: 'Under 220.5', odds: randomOdds(1.8, 2.0) },
          ],
        },
        {
          name: 'Handicap',
          type: 'handicap',
          selections: [
            { name: `${home} -5.5`, odds: randomOdds(1.85, 1.95) },
            { name: `${away} +5.5`, odds: randomOdds(1.85, 1.95) },
          ],
        },
      ],
    });
  }

  for (const [player1, player2] of tennisPlayers) {
    const p1Odds = randomOdds(1.3, 3.5);
    const p2Odds = randomOdds(1.3, 3.5);

    events.push({
      sport: 'tennis',
      name: `${player1} vs ${player2}`,
      home_team: player1,
      away_team: player2,
      start_time: futureDate(1, 7),
      markets: [
        {
          name: 'Match Winner',
          type: 'match_winner',
          selections: [
            { name: player1, odds: p1Odds },
            { name: player2, odds: p2Odds },
          ],
        },
        {
          name: 'Total Sets',
          type: 'over_under',
          selections: [
            { name: 'Over 2.5', odds: randomOdds(1.6, 2.2) },
            { name: 'Under 2.5', odds: randomOdds(1.5, 2.0) },
          ],
        },
      ],
    });
  }

  return events;
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Starting database seed...');

    console.log('Clearing existing data...');
    await client.query('DELETE FROM bets');
    await client.query('DELETE FROM selections');
    await client.query('DELETE FROM markets');
    await client.query('DELETE FROM events');

    const events = generateEvents();
    console.log(`Seeding ${events.length} events...`);

    for (const event of events) {
      const eventId = uuidv4();

      await client.query(
        `INSERT INTO events (id, sport, name, home_team, away_team, start_time, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'upcoming', NOW())`,
        [eventId, event.sport, event.name, event.home_team, event.away_team, event.start_time]
      );

      for (const market of event.markets) {
        const marketId = uuidv4();

        await client.query(
          `INSERT INTO markets (id, event_id, name, type, status, created_at)
           VALUES ($1, $2, $3, $4, 'open', NOW())`,
          [marketId, eventId, market.name, market.type]
        );

        for (const selection of market.selections) {
          await client.query(
            `INSERT INTO selections (id, market_id, name, odds, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [uuidv4(), marketId, selection.name, selection.odds]
          );
        }
      }
    }

    const liveEvents = await client.query(
      `UPDATE events SET status = 'live'
       WHERE id IN (SELECT id FROM events WHERE status = 'upcoming' LIMIT 3)
       RETURNING id, name`
    );

    console.log(`Set ${liveEvents.rowCount} events to live status`);

    console.log('Seed completed successfully!');
    console.log(`Total events: ${events.length}`);
    console.log('  - Football: 10');
    console.log('  - Basketball: 10');
    console.log('  - Tennis: 10');

  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
