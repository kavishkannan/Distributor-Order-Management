import { Router } from "express";
import {
  approveOrder,
  cancelOrder,
  deliverOrder,
  dispatchOrder,
  getAllOrders,
  getOrderById,
  getPendingApprovalOrders,
  placeOrder,
  rejectOrder,
} from "../controllers/order.controller";
import { authenticateUser, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../models/UserEntity";

const AppRouter = Router();

const RequireDistributor = requireRole(UserRole.Distributor);
const RequireSalesManager = requireRole(UserRole.SalesManager);

AppRouter.post("/placeorder", authenticateUser, RequireDistributor, placeOrder);

AppRouter.get(
  "/getallorders",
  authenticateUser,
  RequireSalesManager,
  getAllOrders,
);
AppRouter.get(
  "/getpendingapprovalorders",
  authenticateUser,
  RequireSalesManager,
  getPendingApprovalOrders,
);
AppRouter.get(
  "/getorderbyid/:id",
  authenticateUser,
  RequireSalesManager,
  getOrderById,
);
AppRouter.post(
  "/approveorder/:id",
  authenticateUser,
  RequireSalesManager,
  approveOrder,
);
AppRouter.post(
  "/rejectorder/:id",
  authenticateUser,
  RequireSalesManager,
  rejectOrder,
);
AppRouter.post(
  "/dispatchorder/:id",
  authenticateUser,
  RequireSalesManager,
  dispatchOrder,
);
AppRouter.post(
  "/deliverorder/:id",
  authenticateUser,
  RequireSalesManager,
  deliverOrder,
);

AppRouter.post("/cancelorder/:id", authenticateUser, cancelOrder);

export default AppRouter;
