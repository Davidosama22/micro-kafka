export interface TokenPayload {
  userId: string;
}

export interface JwtPayload {
  tokenPayload: TokenPayload;
}
