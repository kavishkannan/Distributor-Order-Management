import { Router } from "express";
import { getAllProducts } from "../controllers/product.controller";
import { authenticateUser } from "../middleware/auth.middleware";

const AppRouter = Router();

AppRouter.get("/getallproducts", authenticateUser, getAllProducts);

export default AppRouter;
