import { authenticate } from "../../../server/src/authentication/perform-authentication";

describe("perform-authentication.ts", () => {
  describe("authenticate()", () => {
    it("should not allow logging in when given incorrect credentials", () => {
      const result = authenticate("123", "456", "789");
      expect(result).toBe(false);
    });
  });
});
