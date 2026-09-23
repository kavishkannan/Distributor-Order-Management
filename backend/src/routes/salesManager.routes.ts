import { Router } from "express";
import {
  approveOrder,
  cancelOrder,
  deliverOrder,
  dispatchOrder,
  getAllOrders,
  getOrderById,
  getPendingApprovals,
  rejectOrder,
} from "../controllers/salesManager.controller";
import { authenticateUser, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/UserEntity";

const AppRouter = Router();

AppRouter.use(authenticateUser, requireRole(UserRole.SalesManager));

AppRouter.get("/getallorders", getAllOrders);
AppRouter.get("/getpendingapprovals", getPendingApprovals);
AppRouter.get("/getorderbyid/:orderId", getOrderById);
AppRouter.post("/approveorder/:id", approveOrder);
AppRouter.post("/rejectorder/:id", rejectOrder);
AppRouter.post("/cancelorder/:id", cancelOrder);
AppRouter.post("/dispatchorder/:id", dispatchOrder);
AppRouter.post("/deliverorder/:id", deliverOrder);

export default AppRouter;
