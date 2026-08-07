import { randomInt } from "crypto";

// Used to generate share-link tokens, which gate access to private data -
// Math.random() is not cryptographically secure and its output is
// predictable enough to be unsuitable for that purpose.
export const hashContent = (num: number) => {
  const char = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const len = char.length;
  let hash = "";
  for (let i = 0; i < num; i++) {
    hash += char.charAt(randomInt(len));
  }
  return hash;
};
