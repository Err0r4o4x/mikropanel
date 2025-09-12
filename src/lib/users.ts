// src/lib/users.ts
export type User = {
  username: string;
  passwordHash: string;
  role: "owner" | "admin" | "tech" | "viewer" | "envios";
};

export const users: User[] = [
  {
    username: "misael",
    passwordHash: "$2b$10$lbPm5S78zWg.YzfmDnJ8H.rBFYhbVxhsNpeKzjc/KexNdcGUVjVnW", // owner
    role: "owner",
  },
  {
    username: "gaby",
    passwordHash: "$2b$10$Fxs9xCWa53A2BJN4lESImeVEK98AzWyjajWIjB4sfSoH2oLfwWOBe", // gaby12345
    role: "tech",
  },
  {
    username: "kenny",
    passwordHash: "$2b$10$/zw7CMJXLbEVdL.kEQWJO.MUAv9Co390FoPZ6OA.mrI6mj2csafD.", // hash que me pasaste
    role: "tech",
  },
  {
    username: "thalia",
    passwordHash: "$2b$10$ss19JjkH3eb9ifUfzmJP3.eHVMZTKoSgwkump7tEDblsv96zHWK9C", // hash que me pasaste
    role: "envios",
  },
];
