// youtube-transcript-plus ships ESM-only, which ts-jest can't parse from
// node_modules by default. It's also a real network call we never want in
// tests, so it's globally stubbed via jest.config.js's moduleNameMapper
// instead of trying to make Jest transform it.
export const YoutubeTranscript = {
  fetchTranscript: async () => [],
};
