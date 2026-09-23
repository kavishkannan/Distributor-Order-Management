import { ApiClient } from "./client";

export type UserRole = "DISTRIBUTOR" | "SALES_MANAGER";

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  distributorId: string | null;
  salesManagerId: string | null;
}

export interface AuthResultDto {
  user: UserDto;
  token: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  distributorId?: string;
  contactNumber?: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export async function signUp(Input: SignUpInput): Promise<AuthResultDto> {
  const Response = await ApiClient.post<AuthResultDto>("/auth/signup", Input);
  return Response.data;
}

export async function signIn(Input: SignInInput): Promise<AuthResultDto> {
  const Response = await ApiClient.post<AuthResultDto>("/auth/signin", Input);
  return Response.data;
}

export async function getMe(): Promise<UserDto> {
  const Response = await ApiClient.get<UserDto>("/auth/me");
  return Response.data;
}

export async function logout(Token: string): Promise<void> {
  await ApiClient.post("/auth/logout", undefined, {
    headers: { Authorization: `Bearer ${Token}` },
  });
}

export interface SignUpDistributorDto {
  id: string;
  name: string;
}

export async function getSignUpDistributors(): Promise<SignUpDistributorDto[]> {
  const Response =
    await ApiClient.get<SignUpDistributorDto[]>("/auth/distributors");
  return Response.data;
}
