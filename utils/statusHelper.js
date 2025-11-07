export const determineStatus = (commence_time) => {
  const startTime = new Date(commence_time);
  const now = new Date();

  if (startTime > now) return "upcoming";
  if (Math.abs(startTime - now) < 2 * 60 * 60 * 1000) return "live";
  return "completed";
};
