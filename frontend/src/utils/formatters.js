export const formatHiring = (signals, count, atsDetected) => {
  if (atsDetected && count === 0) return "Not hiring";
  if (count === null || count === undefined || count === 0) return "Not found";
  return `Yes (${count})`;
};
