import axios from "axios";
import cron from "node-cron";
import Match from "../models/Match.js";
import logger from "../config/logger.js";

const getTeamImage = (teamName, apiImg) => {
  if (apiImg) return apiImg;
  const t = teamName?.toLowerCase() || "";
  const flags = [
    {
      key: "india",
      url: "https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg",
    },
    {
      key: "australia",
      url: "https://upload.wikimedia.org/wikipedia/en/b/b9/Flag_of_Australia.svg",
    },
    {
      key: "pakistan",
      url: "https://upload.wikimedia.org/wikipedia/commons/3/32/Flag_of_Pakistan.svg",
    },
    {
      key: "england",
      url: "https://upload.wikimedia.org/wikipedia/en/b/be/Flag_of_England.svg",
    },
    {
      key: "south africa",
      url: "https://upload.wikimedia.org/wikipedia/en/a/af/Flag_of_South_Africa.svg",
    },
    {
      key: "new zealand",
      url: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Flag_of_New_Zealand.svg",
    },
    {
      key: "sri lanka",
      url: "https://upload.wikimedia.org/wikipedia/commons/1/11/Flag_of_Sri_Lanka.svg",
    },
    {
      key: "bangladesh",
      url: "https://upload.wikimedia.org/wikipedia/commons/f/f9/Flag_of_Bangladesh.svg",
    },
    {
      key: "west indies",
      url: "https://upload.wikimedia.org/wikipedia/commons/3/38/Flag_of_the_West_Indies_Cricket_Team.svg",
    },
    {
      key: "afghanistan",
      url: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Afghanistan.svg",
    },
  ];
  return (
    flags.find((f) => t.includes(f.key))?.url ||
    "https://cdn-icons-png.flaticon.com/512/197/197560.png"
  );
};

const formatDate = (d) => d.toISOString().split("T")[0];

export const fetchLiveMatches = async () => {
  try {
    const base = process.env.SPORTMONKS_BASE_URL;
    const token = process.env.SPORTMONKS_API_KEY;

    if (!base || !token) {
      logger.warn("⚠️ Missing SPORTMONKS credentials");
      return {
        success: false,
        grouped: { live: [], upcoming: [], completed: [], byLeague: {} },
      };
    }

    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const oneMonthAhead = new Date(now);
    oneMonthAhead.setDate(oneMonthAhead.getDate() + 30);

    const from = formatDate(twoDaysAgo);
    const toUpcoming = formatDate(oneMonthAhead);

    const urls = {
      live: `${base}/livescores?api_token=${token}&include=league,localteam,visitorteam,runs`,
      upcoming: `${base}/fixtures?api_token=${token}&filter[starts_between]=${formatDate(
        now
      )},${toUpcoming}&include=league,localteam,visitorteam`,
      completed: `${base}/fixtures?api_token=${token}&filter[starts_between]=${from},${formatDate(
        now
      )}&filter[status]=Finished&include=league,localteam,visitorteam`,
    };

    logger.info("📡 Fetching from SportMonks...");

    const [liveRes, upcomingRes, completedRes] = await Promise.all([
      axios.get(urls.live).catch(() => ({ data: {} })),
      axios.get(urls.upcoming).catch(() => ({ data: {} })),
      axios.get(urls.completed).catch(() => ({ data: {} })),
    ]);

    const parse = (res) => res?.data?.data || [];

    const normalize = (m) => {
      const local = m.localteam?.data || m.localteam || {};
      const visitor = m.visitorteam?.data || m.visitorteam || {};
      const league = m.league?.data || m.league || {};
      const s = (m.status || "").toLowerCase();

      const runs = Array.isArray(m.runs)
        ? m.runs
        : Array.isArray(m.runs?.data)
        ? m.runs.data
        : [];

      if (!m.localteam_id || !m.visitorteam_id) return null;

      let status = "upcoming";
      if (
        ["live", "stump", "tea", "lunch", "innings", "rain", "drinks"].some(
          (k) => s.includes(k)
        )
      )
        status = "live";
      else if (
        ["finished", "completed", "result", "ft", "ended"].some((k) =>
          s.includes(k)
        )
      )
        status = "completed";
      else if (["scheduled", "ns", "not started"].some((k) => s.includes(k)))
        status = "upcoming";

      let teamA_score = null;
      let teamB_score = null;
      if (Array.isArray(runs) && runs.length) {
        const teamAScoreObj = runs.find((r) => r.team_id === m.localteam_id);
        const teamBScoreObj = runs.find((r) => r.team_id === m.visitorteam_id);

        if (teamAScoreObj) {
          teamA_score = `${teamAScoreObj.score ?? 0}/${
            teamAScoreObj.wickets ?? 0
          } (${teamAScoreObj.overs ?? 0})`;
        }
        if (teamBScoreObj) {
          teamB_score = `${teamBScoreObj.score ?? 0}/${
            teamBScoreObj.wickets ?? 0
          } (${teamBScoreObj.overs ?? 0})`;
        }
      }

      let winner = null;
      if (status === "completed" && m.winner_team_id) {
        if (m.winner_team_id === m.localteam_id) winner = local.name;
        else if (m.winner_team_id === m.visitorteam_id) winner = visitor.name;
        else winner = "Draw / No Result";
      }

      const leagueId = m.league_id || league.id || null;
      const leagueName =
        league.name || (leagueId ? `League #${leagueId}` : "Unknown League");

      return {
        matchId: String(m.id),
        sport: "cricket",
        leagueId,
        leagueName,
        teamA: local.name || `Team ${m.localteam_id}`,
        teamB: visitor.name || `Team ${m.visitorteam_id}`,
        teamA_score,
        teamB_score,
        winner,
        status,
        startTime: m.starting_at,
        imageA: getTeamImage(local.name, local.image_path),
        imageB: getTeamImage(visitor.name, visitor.image_path),
        source: "SportMonks",
      };
    };

    const allFixtures = [
      ...parse(liveRes),
      ...parse(upcomingRes),
      ...parse(completedRes),
    ]
      .map(normalize)
      .filter(Boolean);

    const grouped = {
      live: allFixtures.filter((m) => m.status === "live"),
      upcoming: allFixtures.filter((m) => m.status === "upcoming"),
      completed: allFixtures.filter((m) => m.status === "completed"),
    };

    const byLeague = {};
    allFixtures.forEach((m) => {
      if (!m.leagueName) return;
      if (!byLeague[m.leagueName]) byLeague[m.leagueName] = [];
      byLeague[m.leagueName].push(m);
    });

    if (allFixtures.length) {
      await Match.bulkWrite(
        allFixtures.map((m) => ({
          updateOne: {
            filter: { matchId: m.matchId },
            update: { $set: m },
            upsert: true,
          },
        }))
      );
      logger.info(`✅ ${allFixtures.length} matches synced`);
    } else {
      logger.warn("⚠️ No valid matches fetched");
    }

    logger.info(
      `📊 Counts → Live: ${grouped.live.length}, Upcoming: ${grouped.upcoming.length}, Completed: ${grouped.completed.length}`
    );

    return { success: true, grouped, byLeague };
  } catch (err) {
    logger.error("❌ SportMonks Fetch Error:", err.message);
    return {
      success: false,
      grouped: { live: [], upcoming: [], completed: [], byLeague: {} },
    };
  }
};

export const startSportMonksAutoSync = () => {
  cron.schedule("*/10 * * * *", async () => {
    logger.info("🔁 Auto-sync triggered...");
    await fetchLiveMatches();
  });
  logger.info("✅ SportMonks auto-sync scheduled every 10 minutes");
};
