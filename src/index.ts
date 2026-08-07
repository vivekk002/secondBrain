import mongoose from "mongoose";
require("dotenv").config();

import app from "./app";

const PORT = process.env.PORT;
const mongourl = process.env.MONGOURL!;

mongoose
  .connect(mongourl)
  .then(() => console.log("Connected to MongoDB!"))
  .catch((err) => console.error(err));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
