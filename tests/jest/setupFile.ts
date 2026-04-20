import mongoose from "mongoose";

jest.mock("isomorphic-dompurify", () => ({
  sanitize: (input: string) => input
}));

beforeAll(async () => {
  await mongoose.connect(process.env["MONGO_URI"] as string);
});

afterAll(async () => {
  await mongoose.connection.close();
});
