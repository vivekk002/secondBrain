export const hashContent = (num: number) => {
  const char = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const len = char.length;
  let hash = "";
  for (let i = 0; i < num; i++) {
    hash += char.charAt(Math.floor(Math.random() * len));
  }
  return hash;
};
