import mongoose from "mongoose";

jest.mock("isomorphic-dompurify", () => ({
  sanitize: (input: string) => input
}));

beforeAll(async () => {
  console.log(process.env["MONGO_URI"]);
  await mongoose.connect(process.env["MONGO_URI"] as string);
});

afterAll(async () => {
  await mongoose.disconnect();
});
