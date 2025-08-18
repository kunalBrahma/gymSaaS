// types/next-auth.d.ts

import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  
  interface User extends DefaultUser {
    id: string;
  }

  interface Session {
    user: User; 
  }
}