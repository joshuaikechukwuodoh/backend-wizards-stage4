export interface UserPayload {
  sub: string;
  username: string;
  role: string;
  type?: string;
}

export type HonoEnv = {
  Variables: {
    user: UserPayload;
  };
};
