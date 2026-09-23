import { Router } from "express";
import {
  cancelOrder,
  getDashboard,
  getDistributorById,
  getLoyaltyById,
  getOrderById,
  getOrders,
} from "../controllers/distributor.controller";
import { authenticateUser, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/UserEntity";

const AppRouter = Router();

AppRouter.get("/getdistributorbyid/:id", authenticateUser, getDistributorById);

const RequireDistributor = requireRole(UserRole.Distributor);
AppRouter.get(
  "/getloyaltybyid/:id",
  authenticateUser,
  RequireDistributor,
  getLoyaltyById,
);
AppRouter.get(
  "/getdashboard/:id",
  authenticateUser,
  RequireDistributor,
  getDashboard,
);
AppRouter.get(
  "/getorders/:id",
  authenticateUser,
  RequireDistributor,
  getOrders,
);
AppRouter.get(
  "/getorderbyid/:id/:orderId",
  authenticateUser,
  RequireDistributor,
  getOrderById,
);
AppRouter.post(
  "/cancelorder/:id/:orderId",
  authenticateUser,
  RequireDistributor,
  cancelOrder,
);

export default AppRouter;
