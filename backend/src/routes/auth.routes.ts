import { Router } from "express";
import {
  getMe,
  getSignUpDistributors,
  logout,
  signIn,
  signUp,
} from "../controllers/auth.controller";
import { authenticateUser } from "../middleware/auth.middleware";

const AppRouter = Router();

AppRouter.post("/signup", signUp);
AppRouter.post("/signin", signIn);
AppRouter.get("/distributors", getSignUpDistributors);
AppRouter.get("/me", authenticateUser, getMe);
AppRouter.post("/logout", authenticateUser, logout);

export default AppRouter;
