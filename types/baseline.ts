export interface BaselineResponse {
  type: "baseline";
  model: string;
  query: string;
  finalAnswer: string | null;
  usage: {
    totalTokens: number;
  };
  latency: {
    totalMs: number;
  };
  meta: {
    totalItems: number;
    sentToLLM: number;
  };
}
