import axios from "axios";
import cron from "node-cron";
import Match from "../models/Match.js";
import logger from "../config/logger.js";
import { getIO } from "../sockets/socket.js"; // ✅ use your existing socket

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
      logger.warn("Missing SPORTMONKS credentials");
      return { success: false };
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

    logger.info("Fetching from SportMonks...");

    const [liveRes, upcomingRes, completedRes] = await Promise.all([
      axios.get(urls.live).catch(() => ({ data: {} })),
      axios.get(urls.upcoming).catch(() => ({ data: {} })),
      axios.get(urls.completed).catch(() => ({ data: {} })),
    ]);

    const parse = (res) => res?.data?.data || [];

    const normalize = (m) => {
      const local =
        m.localteam && m.localteam.data ? m.localteam.data : m.localteam || {};
      const visitor =
        m.visitorteam && m.visitorteam.data
          ? m.visitorteam.data
          : m.visitorteam || {};
      const league = m.league && m.league.data ? m.league.data : m.league || {};
      const s = String(m.status || "").toLowerCase();

      const runs = Array.isArray(m.runs)
        ? m.runs
        : Array.isArray(m.runs?.data)
        ? m.runs.data
        : [];

      if (!m.localteam_id || !m.visitorteam_id) return null;

      let status = "upcoming";
      if (["live", "stump", "innings", "drinks"].some((k) => s.includes(k)))
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
        const a = runs.find(
          (r) => Number(r.team_id) === Number(m.localteam_id)
        );
        const b = runs.find(
          (r) => Number(r.team_id) === Number(m.visitorteam_id)
        );
        if (a)
          teamA_score = `${a.score ?? 0}/${a.wickets ?? 0} (${a.overs ?? 0})`;
        if (b)
          teamB_score = `${b.score ?? 0}/${b.wickets ?? 0} (${b.overs ?? 0})`;
      }

      const winner =
        status === "completed" && m.winner_team_id
          ? m.winner_team_id === m.localteam_id
            ? local.name
            : m.winner_team_id === m.visitorteam_id
            ? visitor.name
            : "Draw / No Result"
          : null;

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

    if (!allFixtures.length) {
      logger.warn("No valid matches fetched");
      return;
    }

    // save or update
    await Match.bulkWrite(
      allFixtures.map((m) => ({
        updateOne: {
          filter: { matchId: m.matchId },
          update: { $set: m },
          upsert: true,
        },
      }))
    );

    logger.info(`${allFixtures.length} matches synced`);

    // ✅ Emit live score updates via Socket.io
    const io = getIO();
    const liveMatches = allFixtures.filter((m) => m.status === "live");

    liveMatches.forEach((match) => {
      io.emit("match:scoreUpdate", {
        matchId: match.matchId,
        teamA: match.teamA,
        teamB: match.teamB,
        teamA_score: match.teamA_score,
        teamB_score: match.teamB_score,
        status: match.status,
      });
    });

    logger.info(`⚡ Live scores emitted for ${liveMatches.length} matches`);
  } catch (err) {
    logger.error("SportMonks Fetch Error:", err.message);
  }
};

export const startSportMonksAutoSync = () => {
  if (global.__sportmonksScheduled) return;
  global.__sportmonksScheduled = true;
  cron.schedule("*/1 * * * *", async () => {
    // every 1 min (change back to 10 later)
    logger.info("Auto-sync triggered...");
    await fetchLiveMatches();
  });
  logger.info("SportMonks auto-sync scheduled every 1 minute");
};
