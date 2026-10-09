export const formatHiring = (signals, count) => {
  if (count === null || count === undefined) return "Not found";
  if (count === 0) return "Not hiring";
  return `Yes (${count})`;
};
