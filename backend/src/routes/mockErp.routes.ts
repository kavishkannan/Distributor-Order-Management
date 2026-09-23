import { Router } from "express";
import { receiveEvent } from "../controllers/mockErp.controller";

const AppRouter = Router();

AppRouter.post("/", receiveEvent);

export default AppRouter;
