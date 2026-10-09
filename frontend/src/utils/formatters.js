export const formatHiring = (signals, count) => {
  if (signals === true) return count ? `Yes (${count})` : "Yes";
  if (signals === false) return "Not hiring";
  return "Not found";
};
