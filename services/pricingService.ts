
// Estimated cost per image generation for High Quality models (e.g., Gemini 3 Pro Image / Imagen 3)
// This is an approximation based on standard industry rates for HQ generation (approx $0.04 USD).
export const ESTIMATED_IMAGE_COST_USD = 0.04;

export const formatCost = (cost: number): string => {
  return `~$${cost.toFixed(2)} USD`;
};

export const getCostMessage = (): string => {
  return `預估費用: ${formatCost(ESTIMATED_IMAGE_COST_USD)}`;
};
