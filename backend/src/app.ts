import cors from "cors";
import express, { Request, Response } from "express";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import authRoutes from "./routes/auth.routes";
import distributorRoutes from "./routes/distributor.routes";
import mockErpRoutes from "./routes/mockErp.routes";
import orderRoutes from "./routes/order.routes";
import productRoutes from "./routes/product.routes";
import salesManagerRoutes from "./routes/salesManager.routes";

export const App = express();

App.use(requestLogger);
App.use(cors());
App.use(express.json());

App.use("/api/auth", authRoutes);
App.use("/api/product", productRoutes);
App.use("/api/order", orderRoutes);
App.use("/api/distributor", distributorRoutes);
App.use("/api/salesmanager", salesManagerRoutes);
App.use("/mockerp", mockErpRoutes);

App.use((Req: Request, Res: Response) => {
  Res.status(404).json({ message: "Route not found" });
});

App.use(errorHandler);
