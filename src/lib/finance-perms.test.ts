import { describe, expect, it } from "vitest";
import { assertFinance } from "./finance-perms";

const client = (role: string) => ({ from: (table: string) => ({ select: () => ({ eq: () => table === "user_roles" ? Promise.resolve({ data: [{ role }] }) : ({ maybeSingle: async () => ({ data: null }) }) }) }) });
describe("administrator signature access", () => {
  it("allows an administrator to manage and apply their signature", async () => {
    await expect(assertFinance(client("admin"), "admin-id", undefined, true)).resolves.toMatchObject({ isAdmin: true });
  });
  it("does not let ordinary finance staff save or apply administrator signatures", async () => {
    await expect(assertFinance(client("staff"), "staff-id", undefined, true)).rejects.toThrow("permission");
  });
});