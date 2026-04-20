import { authenticate } from "../../../server/src/authentication/perform-authentication";

describe("perform-authentication.ts", () => {
  describe("authenticate()", () => {
    it("should not allow logging in when given incorrect credentials", async () => {
      const result = await authenticate("123", "456", "1234567890123456");
      console.log(result);
      expect(result).toBe(false);
    });
  });
});
