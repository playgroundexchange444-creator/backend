import mongoose from "mongoose";
import Bet from "../models/Bet.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Match from "../models/Match.js";
import Odds from "../models/Odds.js";
import { getIO } from "../sockets/socket.js";
import { recordCommission } from "./commissionService.js";
import logger from "../config/logger.js";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const isUpcoming = (m) => m && m.status === "upcoming";

const computeTakerStake = (makerStake, makerOdds, takerOdds) => {
  const ms = toNum(makerStake, 0);
  const mo = toNum(makerOdds, 1);
  const to = toNum(takerOdds, 1);
  return +((ms * Math.max(0, mo - 1)) / Math.max(1e-6, to - 1)).toFixed(2);
};

const ensureMatch = async (matchId, session = null) => {
  let match = await Match.findOne({ matchId }).session(session);
  if (match) return match;
  const odds = await Odds.findOne({ matchId }).lean();
  if (!odds) return null;
  return (
    await Match.create(
      [
        {
          matchId,
          sport: odds.sport || "cricket",
          teamA: odds.teams?.teamA ?? "Team A",
          teamB: odds.teams?.teamB ?? "Team B",
          oddsA: toNum(odds.odds?.teamA, 1),
          oddsB: toNum(odds.odds?.teamB, 1),
          status: odds.status || "upcoming",
          settled: false,
        },
      ],
      { session }
    )
  )[0];
};

export const placeBet = async ({
  makerId,
  matchId,
  sport,
  team,
  stake,
  odds,
  acceptWindowSec = 120,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let match = await Match.findOne({ matchId }).session(session);
    if (!match) match = await ensureMatch(matchId, session);
    if (!match || !isUpcoming(match)) throw new Error("Betting closed");

    if (![match.teamA, match.teamB].includes(team))
      throw new Error("Invalid team");

    const maker = await User.findById(makerId).session(session);
    if (!maker) throw new Error("User not found");
    const makerStake = toNum(stake);
    if (maker.balance < makerStake) throw new Error("Insufficient balance");

    maker.balance -= makerStake;
    await maker.save({ session });

    const oddsA = toNum(match.oddsA, 1);
    const oddsB = toNum(match.oddsB, 1);
    const makerOdds = toNum(odds, 1);
    const oppositeOdds = team === match.teamA ? oddsB : oddsA;

    const [bet] = await Bet.create(
      [
        {
          makerId,
          matchId,
          sport: sport || match.sport,
          teamA: match.teamA,
          teamB: match.teamB,
          makerTeam: team,
          makerStake,
          makerOdds,
          oppositeOdds,
          status: "pending",
          potentialWin: +(makerStake * makerOdds).toFixed(2),
          expireAt: new Date(Date.now() + acceptWindowSec * 1000),
        },
      ],
      { session }
    );

    await Transaction.create(
      [
        {
          userId: makerId,
          amount: makerStake,
          type: "debit",
          method: "bet",
          status: "success",
          note: `Placed bet on ${team} (${matchId})`,
          meta: { betId: bet._id },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    getIO().emit("bet:pending", bet);
    logger.info(`Bet placed: ${bet._id}`);
    return bet;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const acceptBet = async ({ betId, takerId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const bet = await Bet.findById(betId).session(session);
    if (!bet || bet.status !== "pending") throw new Error("Invalid bet");
    if (String(bet.makerId) === takerId)
      throw new Error("Cannot accept own bet");

    let match = await Match.findOne({ matchId: bet.matchId }).session(session);
    if (!match || !isUpcoming(match)) throw new Error("Betting closed");

    const makerTeam = bet.makerTeam;
    const takerTeam = makerTeam === match.teamA ? match.teamB : match.teamA;

    const taker = await User.findById(takerId).session(session);
    const takerStake = computeTakerStake(
      bet.makerStake,
      bet.makerOdds,
      bet.oppositeOdds
    );
    if (taker.balance < takerStake) throw new Error("Insufficient balance");

    taker.balance -= takerStake;
    await taker.save({ session });

    Object.assign(bet, {
      takerId,
      takerTeam,
      takerStake,
      takerOdds: bet.oppositeOdds,
      status: "active",
      matchedAt: new Date(),
    });
    await bet.save({ session });

    await Transaction.create(
      [
        {
          userId: takerId,
          amount: takerStake,
          type: "debit",
          method: "bet",
          status: "success",
          note: `Accepted bet ${bet.matchId}`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    getIO().emit("bet:update", bet);
    return bet;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const settleBet = async ({
  betId,
  winnerTeam,
  commissionRate = 0.05,
  settledBy,
  session: extSession = null,
}) => {
  const session = extSession || (await mongoose.startSession());
  if (!extSession) session.startTransaction();
  try {
    const bet = await Bet.findById(betId).session(session);
    if (!bet || bet.settled || !bet.takerId) return null;

    const maker = await User.findById(bet.makerId).session(session);
    const taker = await User.findById(bet.takerId).session(session);
    const makerWins = bet.makerTeam === winnerTeam;

    const totalPool = bet.makerStake + bet.takerStake;
    const profit = makerWins ? bet.takerStake : bet.makerStake;
    const commission = +(profit * commissionRate).toFixed(2);
    const credit = +(totalPool - commission).toFixed(2);
    const winner = makerWins ? maker : taker;

    winner.balance += credit;
    await winner.save({ session });

    await Transaction.create(
      [
        {
          userId: winner._id,
          amount: credit,
          type: "credit",
          method: "settlement",
          status: "success",
          note: `Bet win ${bet.matchId}`,
        },
      ],
      { session }
    );

    await recordCommission({
      matchId: bet.matchId,
      userId: winner._id,
      betId,
      winAmount: profit,
      commissionPercent: commissionRate,
    });

    bet.settled = true;
    bet.winnerTeam = winnerTeam;
    bet.status = makerWins ? "won" : "lost";
    bet.settledAt = new Date();
    bet.settledBy = settledBy;
    await bet.save({ session });

    if (!extSession) {
      await session.commitTransaction();
      session.endSession();
    }

    getIO().emit("bet:settled", bet);
    return bet;
  } catch (err) {
    if (!extSession) {
      await session.abortTransaction();
      session.endSession();
    }
    throw err;
  }
};

export const deleteBet = async (betId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const bet = await Bet.findById(betId).session(session);
    if (!bet) throw new Error("Bet not found");
    if (String(bet.makerId) !== String(userId))
      throw new Error("Not authorized");
    if (bet.status !== "pending")
      throw new Error("Only pending bets can be deleted");

    const refundAmount = bet.makerStake;
    const user = await User.findById(userId).session(session);
    user.balance += refundAmount;
    await user.save({ session });

    await Transaction.create(
      [
        {
          userId,
          amount: refundAmount,
          type: "credit",
          method: "settlement",
          status: "success",
          note: `Refund for bet ${bet.matchId}`,
        },
      ],
      { session }
    );

    await Bet.findByIdAndDelete(betId).session(session);

    await session.commitTransaction();
    session.endSession();
    return true;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const getMyBets = (userId) => {
  return Bet.find({ $or: [{ makerId: userId }, { takerId: userId }] })
    .sort({ createdAt: -1 })
    .lean();
};

export const getOpenBets = () => {
  return Bet.find({ status: "pending" })
    .populate("makerId", "username balance")
    .sort({ createdAt: -1 })
    .lean();
};

export const updateBet = async ({ betId, userId, stake, odds }) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const bet = await Bet.findById(betId).session(session);
    if (!bet) throw new Error("Bet not found");
    if (String(bet.makerId) !== String(userId)) throw new Error("Not owner");
    if (bet.status !== "pending") throw new Error("Only pending bets editable");

    let updated = false;
    const user = await User.findById(userId).session(session);

    if (stake && stake > 0) {
      const diff = stake - bet.makerStake;
      if (diff > 0 && user.balance < diff)
        throw new Error("Insufficient balance");
      user.balance -= diff;
      bet.makerStake = stake;
      updated = true;
      await user.save({ session });
    }

    if (odds && odds > 0) {
      bet.makerOdds = odds;
      updated = true;
    }

    if (updated) {
      bet.potentialWin = bet.makerStake * bet.makerOdds;
      await bet.save({ session });
    }

    await session.commitTransaction();
    session.endSession();
    return bet;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
export const settleMatch = async ({ matchId, winnerTeam, settledBy }) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const match = await Match.findOne({ matchId }).session(session);
    if (!match) throw new Error("Match not found");

    const bets = await Bet.find({
      matchId,
      status: "active",
      settled: { $ne: true },
      takerId: { $ne: null },
    }).session(session);

    if (!bets.length) throw new Error("No active bets to settle");

    for (const bet of bets) {
      await settleBet({
        betId: bet._id,
        winnerTeam,
        settledBy,
        session,
      });
    }

    match.status = "finished";
    match.winnerTeam = winnerTeam;
    match.settled = true;
    await match.save({ session });

    await session.commitTransaction();
    session.endSession();

    getIO().emit("match:settled", { matchId, winnerTeam });
    return { success: true, message: "Match settled successfully" };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
